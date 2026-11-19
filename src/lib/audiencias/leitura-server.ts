import "server-only";

import { z } from "zod";
import { duplaDaPasta } from "./duplas";
import { avisarMudanca } from "./avisos-server";
import { chaveDoLink, diferencas, ligarRedesignacoes, normalizarRegistroPje, type RegistroPjeBruto, type RegistroTribunal } from "./pje";
import { pastasPorCnj } from "./pastas-server";
import { AudienciasError, carregarPessoas, COLUNAS_AUDIENCIA, db, falhou, paraAudiencia, registrarHistorico } from "./server";
import type { Audiencia, Mudanca } from "./tipos";

/**
 * Grava uma leitura da Minha Pauta do PJe (o robô manda os registros como vieram). Audiência nova ganha a dupla da
 * pasta no VIOS; redesignação (registro cancelado + novo) herda titular e backup e diz o que mudou; mudança vista
 * entre leituras também vale. O que mudou fica em vermelho até alguém conferir no VIOS.
 */

const esquema = z.object({
  tribunal: z.string().regex(/^TRT\d{1,2}$/),
  origem: z.string().trim().min(1).max(80),
  registros: z.array(z.record(z.string(), z.unknown())).max(5000),
});

export interface ResumoLeitura {
  total: number;
  novas: number;
  alteradas: number;
  canceladas: number;
  semDupla: number;
}

type Linha = Record<string, unknown>;

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) saida.push(itens.slice(i, i + tamanho));
  return saida;
}

function comoRegistro(a: Audiencia): Pick<RegistroTribunal, "tipo" | "inicio" | "orgao" | "link"> {
  return { tipo: a.tipo, inicio: a.inicio, orgao: a.orgao, link: a.linkFonte === "pje" ? a.linkSala : null };
}

export async function registrarLeituraPje(entrada: unknown): Promise<ResumoLeitura> {
  const lido = esquema.safeParse(entrada);
  if (!lido.success) throw new AudienciasError(lido.error.issues[0]?.message ?? "Leitura inválida.", 400);
  const { tribunal, origem } = lido.data;
  const { data: leitura } = await db().from("aud_leituras").insert({ fonte: "pje", tribunal, origem }).select("id").single();
  try {
    const resumo = await gravar(tribunal, lido.data.registros as unknown as RegistroPjeBruto[]);
    if (leitura) await db().from("aud_leituras").update({ terminada_em: new Date().toISOString(), ...resumoParaColunas(resumo) }).eq("id", leitura.id);
    return resumo;
  } catch (erro) {
    if (leitura) await db().from("aud_leituras").update({ terminada_em: new Date().toISOString(), erro: erro instanceof Error ? erro.message : String(erro) }).eq("id", leitura.id);
    throw erro;
  }
}

function resumoParaColunas(r: ResumoLeitura) {
  return { total: r.total, novas: r.novas, alteradas: r.alteradas, canceladas: r.canceladas, detalhe: { semDupla: r.semDupla } };
}

async function gravar(tribunal: string, brutos: RegistroPjeBruto[]): Promise<ResumoLeitura> {
  const registros = brutos.map((b) => normalizarRegistroPje(b, tribunal)).filter((r): r is RegistroTribunal => Boolean(r));
  const resumo: ResumoLeitura = { total: registros.length, novas: 0, alteradas: 0, canceladas: 0, semDupla: 0 };
  if (!registros.length) return resumo;

  const existentes = new Map<string, Audiencia>();
  for (const lote of emLotes(registros.map((r) => r.chave), 200)) {
    const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).in("chave", lote);
    if (error) falhou("ler a pauta gravada", error);
    for (const l of (data ?? []) as Linha[]) existentes.set(String(l.chave), paraAudiencia(l));
  }
  const pessoas = await carregarPessoas();
  const pastas = await pastasPorCnj(registros.filter((r) => !existentes.get(r.chave)?.cliente).map((r) => r.cnj));
  const redesignacoes = ligarRedesignacoes(registros);
  const substituidas = new Set(redesignacoes.flatMap((r) => r.substitui));
  const agora = new Date().toISOString();

  const novas: Linha[] = [];
  const atualizacoes: { chave: string; campos: Linha; mudancasNovas: Mudanca[]; antes: Audiencia }[] = [];

  for (const r of registros) {
    const antes = existentes.get(r.chave);
    const pasta = pastas.get(r.cnj);
    const base: Linha = {
      origem: "pje",
      tribunal,
      cnj: r.cnj,
      inicio: r.inicio,
      fim: r.fim,
      tipo: r.tipo,
      tipo_descricao: r.tipoDescricao,
      rito_sumarissimo: r.ritoSumarissimo,
      modalidade_tribunal: r.modalidade,
      orgao: r.orgao,
      sala: r.sala,
      juizo_digital: r.juizoDigital,
      situacao: r.situacao,
      reclamante_iniciais: r.reclamanteIniciais,
      lida_em: agora,
    };
    if (r.link) Object.assign(base, { link_sala: r.link, link_fonte: "pje", link_fonte_data: null });
    if (pasta) Object.assign(base, { cliente: pasta.cliente, grupo_cliente: pasta.grupoCliente, ci_processo: pasta.ci });
    else if (!antes?.cliente) base.cliente = r.clienteNoTribunal;

    if (!antes) {
      const dupla = pasta ? duplaDaPasta(pessoas, { advogadoResponsavel: pasta.advogadoResponsavel, auxiliarSigla: pasta.auxiliarSigla }) : { titularId: null, backupId: null };
      if (!dupla.titularId && r.situacao === "designada") resumo.semDupla += 1;
      const cancelamentoPuro = r.situacao === "cancelada" && !substituidas.has(r.chave);
      novas.push({
        ...base,
        chave: r.chave,
        titular_id: dupla.titularId,
        backup_id: dupla.backupId,
        mudancas: cancelamentoPuro ? ["cancelada"] : [],
        // Metade antiga de uma redesignação: o alerta fica na audiência nova.
        mudanca_conferida_em: r.situacao === "cancelada" && !cancelamentoPuro ? agora : null,
        mudanca_conferida_por: r.situacao === "cancelada" && !cancelamentoPuro ? "sistema: redesignada" : null,
      });
      resumo.novas += 1;
      if (cancelamentoPuro) resumo.canceladas += 1;
      continue;
    }

    const mudancasNovas: Mudanca[] = antes.situacao === "designada" ? diferencas(comoRegistro(antes), r) : [];
    if (antes.situacao === "designada" && r.situacao === "cancelada" && !substituidas.has(r.chave)) mudancasNovas.push("cancelada");
    if (r.link && antes.linkSala && chaveDoLink(antes.linkSala) !== chaveDoLink(r.link)) base.link_anterior = antes.linkSala;
    if (mudancasNovas.length) {
      base.mudancas = [...new Set([...antes.mudancas, ...mudancasNovas])];
      base.mudanca_conferida_em = null;
      base.mudanca_conferida_por = null;
      resumo.alteradas += 1;
      if (mudancasNovas.includes("cancelada")) resumo.canceladas += 1;
    }
    if (antes.situacao === "designada" && r.situacao === "cancelada" && substituidas.has(r.chave)) {
      base.mudanca_conferida_em = agora;
      base.mudanca_conferida_por = "sistema: redesignada";
    }
    atualizacoes.push({ chave: r.chave, campos: base, mudancasNovas, antes });
  }

  const ids = new Map<string, string>();
  for (const a of existentes.values()) ids.set(a.chave, a.id);
  for (const lote of emLotes(novas, 200)) {
    const { data, error } = await db().from("aud_audiencias").insert(lote).select("id, chave");
    if (error) falhou("gravar as audiências novas", error);
    for (const l of (data ?? []) as { id: string; chave: string }[]) ids.set(l.chave, l.id);
  }
  for (const lote of emLotes(atualizacoes, 10)) {
    await Promise.all(
      lote.map(async (u) => {
        const { error } = await db().from("aud_audiencias").update(u.campos).eq("chave", u.chave);
        if (error) falhou("atualizar a pauta", error);
      })
    );
  }

  // Redesignação: a audiência nova aponta para a antiga, herda a dupla e guarda o que mudou.
  for (const red of redesignacoes) {
    const id = ids.get(red.chave);
    const antigaId = red.substitui.map((c) => ids.get(c)).find(Boolean) ?? null;
    if (!id) continue;
    const { data: atual } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).eq("id", id).single();
    if (!atual) continue;
    const aud = paraAudiencia(atual as Linha);
    const antigas = [...existentes.values()].filter((a) => red.substitui.includes(a.chave));
    const herdada = antigas.find((a) => a.titularId) ?? null;
    const campos: Linha = { substitui_id: antigaId };
    if (herdada && !aud.titularId) Object.assign(campos, { titular_id: herdada.titularId, backup_id: herdada.backupId ?? aud.backupId });
    const novasMudancas = red.mudancas.filter((m) => !aud.mudancas.includes(m));
    if (novasMudancas.length && !aud.mudancaConferidaEm) campos.mudancas = [...aud.mudancas, ...novasMudancas];
    if (red.linkAnterior && !aud.linkAnterior) campos.link_anterior = red.linkAnterior;
    await db().from("aud_audiencias").update(campos).eq("id", id);
    if (novasMudancas.length && !existentes.has(red.chave)) {
      resumo.alteradas += 1;
      await registrarHistorico(id, "mudou no tribunal", { para: novasMudancas.join(", "), feitoPor: "leitura do PJe" });
    }
  }

  for (const u of atualizacoes) {
    if (!u.mudancasNovas.length) continue;
    const id = ids.get(u.chave);
    if (!id) continue;
    await registrarHistorico(id, "mudou no tribunal", { de: u.antes.inicio, para: u.mudancasNovas.join(", "), feitoPor: "leitura do PJe" });
    const { data } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).eq("id", id).single();
    if (data) await avisarMudanca(paraAudiencia(data as Linha));
  }
  return resumo;
}
