import "server-only";

import { z } from "zod";
import { hojeEmBrasilia, local, somarDias } from "./agenda";
import { avisarMudanca } from "./avisos-server";
import { duplaDaPasta } from "./duplas";
import { heranca, jusbrComPje, linhaDoJusbr, type LinhaDoJusbr } from "./jusbr";
import { pastasPorCnj } from "./pastas-server";
import { cnjComMascara } from "./pje";
import { reservasComTribunal } from "./reserva";
import { AudienciasError, carregarPessoas, COLUNAS_AUDIENCIA, db, falhou, paraAudiencia, registrarHistorico } from "./server";
import type { Audiencia, Mudanca } from "./tipos";

/**
 * Grava as audiências que o robô leu no Jus.br para processos fora da Minha Pauta (audiências "só no VIOS" e as que
 * já vieram de lá). Audiência nova só entra designada e ganha a dupla da pasta no VIOS; a que já está na pauta muda de
 * situação como a do PJe (cancelada fica em vermelho até alguém conferir no VIOS). Se o PJe já mostra a audiência no
 * mesmo dia, a do Jus.br não entra.
 */

const esquema = z.object({
  origem: z.string().trim().min(1).max(80),
  consultados: z.array(z.string().max(40)).max(200),
  audiencias: z
    .array(
      z.object({
        cnj: z.string().max(40),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        descricao: z.string().max(300),
        situacao: z.enum(["designada", "cancelada", "realizada"]),
        sala: z.string().max(300).nullable(),
        orgao: z.string().max(300).nullable(),
        movimentoEm: z.string().max(40).nullable(),
      })
    )
    .max(1000),
});

export interface ResumoJusbr {
  consultados: number;
  novas: number;
  atualizadas: number;
  canceladas: number;
  jaNoPje: number;
}

type Linha = Record<string, unknown>;

export async function registrarLeituraJusbr(entrada: unknown): Promise<ResumoJusbr> {
  const lido = esquema.safeParse(entrada);
  if (!lido.success) throw new AudienciasError(`Leitura do Jus.br inválida: ${lido.error.issues[0]?.message ?? "formato"}.`, 400);
  const corpo = lido.data;
  const resumo: ResumoJusbr = { consultados: corpo.consultados.length, novas: 0, atualizadas: 0, canceladas: 0, jaNoPje: 0 };
  const { data: leitura } = await db().from("aud_leituras").insert({ fonte: "jusbr", origem: corpo.origem }).select("id").single();
  try {
    const linhas = corpo.audiencias.map(linhaDoJusbr).filter((l): l is LinhaDoJusbr => Boolean(l));
    const cnjs = [...new Set([...corpo.consultados.map((c) => cnjComMascara(c)).filter((c): c is string => Boolean(c)), ...linhas.map((l) => l.cnj)])];
    const desde = `${somarDias(hojeEmBrasilia(), -1)}T00:00:00-03:00`;
    const existentes: Audiencia[] = [];
    for (let i = 0; i < cnjs.length; i += 150) {
      const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).in("cnj", cnjs.slice(i, i + 150)).gte("inicio", desde);
      if (error) falhou("ler a pauta para gravar o Jus.br", error);
      existentes.push(...((data ?? []) as Linha[]).map(paraAudiencia));
    }
    const porChave = new Map(existentes.map((a) => [a.chave, a]));
    const noPje = new Set(existentes.filter((a) => a.origem === "pje" && a.situacao === "designada").map((a) => `${a.cnj}|${local(a.inicio).dia}`));
    const pessoas = await carregarPessoas();
    const pastas = await pastasPorCnj(linhas.filter((l) => !porChave.has(l.chave) && l.situacao === "designada").map((l) => l.cnj));
    const agora = new Date().toISOString();

    for (const l of linhas) {
      const antes = porChave.get(l.chave);
      if (!antes) {
        if (l.situacao !== "designada") continue;
        if (noPje.has(`${l.cnj}|${local(l.inicio).dia}`)) {
          resumo.jaNoPje += 1;
          continue;
        }
        const pasta = pastas.get(l.cnj);
        const dupla = pasta ? duplaDaPasta(pessoas, { advogadoResponsavel: pasta.advogadoResponsavel, auxiliarSigla: pasta.auxiliarSigla }) : { titularId: null, backupId: null };
        const { data, error } = await db()
          .from("aud_audiencias")
          .insert({
            ...l,
            cliente: pasta?.cliente ?? null,
            grupo_cliente: pasta?.grupoCliente ?? null,
            ci_processo: pasta?.ci ?? null,
            titular_id: dupla.titularId,
            backup_id: dupla.backupId,
            lida_em: agora,
          })
          .select(COLUNAS_AUDIENCIA)
          .single();
        if (error) falhou("gravar a audiência lida no Jus.br", error);
        resumo.novas += 1;
        if (data) {
          const nova = paraAudiencia(data as Linha);
          await registrarHistorico(nova.id, "incluída pelo Jus.br", { para: `${l.inicio.slice(0, 16)} · ${l.tipo_descricao}`, feitoPor: "leitura do Jus.br" });
          // A mesma audiência "a confirmar" (do VIOS ou da Vistagem): a do Jus.br passa a valer e herda a dupla.
          const dia = local(nova.inicio).dia;
          const reserva = existentes.find((a) => a.origem === "vios" && a.situacao === "designada" && a.tipo !== "pericia" && a.cnj === nova.cnj && local(a.inicio).dia === dia);
          if (reserva) await passarParaOTribunal(reserva, nova, "leitura do Jus.br");
        }
        continue;
      }
      if (antes.origem !== "jusbr") continue;
      const campos: Linha = { tipo: l.tipo, tipo_descricao: l.tipo_descricao, rito_sumarissimo: l.rito_sumarissimo, modalidade_tribunal: l.modalidade_tribunal, orgao: l.orgao, sala: l.sala, situacao: l.situacao, lida_em: agora };
      const mudancasNovas: Mudanca[] = [];
      if (antes.situacao === "designada" && l.situacao === "cancelada") mudancasNovas.push("cancelada");
      if (antes.orgao && l.orgao && antes.orgao !== l.orgao && l.situacao === "designada") mudancasNovas.push("vara");
      if (mudancasNovas.length) Object.assign(campos, { mudancas: [...new Set([...antes.mudancas, ...mudancasNovas])], mudanca_conferida_em: null, mudanca_conferida_por: null });
      const { error } = await db().from("aud_audiencias").update(campos).eq("id", antes.id);
      if (error) falhou("atualizar a audiência lida no Jus.br", error);
      resumo.atualizadas += 1;
      if (mudancasNovas.includes("cancelada")) resumo.canceladas += 1;
      if (mudancasNovas.length) {
        await registrarHistorico(antes.id, "mudou no tribunal", { de: antes.inicio, para: mudancasNovas.join(", "), feitoPor: "leitura do Jus.br" });
        const { data } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).eq("id", antes.id).single();
        if (data) await avisarMudanca(paraAudiencia(data as Linha));
      }
    }
    if (leitura)
      await db()
        .from("aud_leituras")
        .update({ terminada_em: new Date().toISOString(), total: linhas.length, novas: resumo.novas, alteradas: resumo.atualizadas, canceladas: resumo.canceladas, detalhe: resumo })
        .eq("id", leitura.id);
    return resumo;
  } catch (erro) {
    if (leitura) await db().from("aud_leituras").update({ terminada_em: new Date().toISOString(), erro: erro instanceof Error ? erro.message : String(erro) }).eq("id", leitura.id);
    throw erro;
  }
}

/**
 * Quando o PJe passa a mostrar uma audiência que veio do Jus.br (mesmo processo, mesmo dia), a do PJe vale: herda
 * titular, backup e o que a equipe completou, e a do Jus.br sai da pauta (cancelada, já conferida). Os convites do
 * Outlook passam para a do PJe (a pessoa recebe uma atualização, não um cancelamento seguido de convite novo), salvo
 * se a do PJe já tiver o seu. Devolve quantas.
 */
export async function substituirJusbrPeloPje(audiencias: Audiencia[]): Promise<number> {
  const pares = jusbrComPje(audiencias);
  for (const { jusbr, pje } of pares) await passarParaOTribunal(jusbr, pje, "conferência com o VIOS");
  return pares.length;
}

/**
 * Logo depois de uma leitura do PJe: a audiência que estava na pauta pelo Jus.br ou "a confirmar" (VIOS/Vistagem) e
 * que o PJe passou a mostrar sai na hora, e a do PJe herda a dupla. Antes a troca esperava a conferência com o VIOS, e
 * nesse meio-tempo a mesma audiência ficava duas vezes na pauta (24/11/2026: alerta de conflito da pessoa com ela mesma).
 */
export async function passarParaOPje(cnjs: string[], feitoPor = "leitura do PJe"): Promise<number> {
  const unicos = [...new Set(cnjs.filter(Boolean))];
  if (!unicos.length) return 0;
  const carregar = async () => {
    const auds: Audiencia[] = [];
    for (let i = 0; i < unicos.length; i += 200) {
      const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).in("cnj", unicos.slice(i, i + 200)).eq("situacao", "designada");
      if (error) falhou("ler as audiências dos processos lidos", error);
      for (const l of (data ?? []) as Linha[]) auds.push(paraAudiencia(l));
    }
    return auds;
  };
  let auds = await carregar();
  const doJusbr = jusbrComPje(auds);
  for (const { jusbr, pje } of doJusbr) await passarParaOTribunal(jusbr, pje, feitoPor);
  if (doJusbr.length) auds = await carregar();
  const aConfirmar = reservasComTribunal(auds, new Map());
  for (const { reserva, tribunal } of aConfirmar) await passarParaOTribunal(reserva, tribunal, feitoPor);
  return doJusbr.length + aConfirmar.length;
}

const NOME_DA_ORIGEM: Record<Audiencia["origem"], string> = { pje: "do PJe", jusbr: "do Jus.br", vios: "do VIOS", manual: "manual" };

/**
 * A audiência `nova` (do tribunal) passa a valer no lugar da `velha` (do Jus.br ou "a confirmar" do VIOS): herda o que
 * a equipe completou e os convites do Outlook, e a velha sai da pauta (cancelada, já conferida). Da "a confirmar" vêm
 * também titular e backup: a coordenação pode já ter distribuído (a do Jus.br só preenche o que a do PJe não tem).
 */
export async function passarParaOTribunal(velha: Audiencia, nova: Audiencia, feitoPor: string): Promise<void> {
  const campos = heranca(velha, nova);
  if (velha.origem === "vios") {
    if (velha.titularId && velha.titularId !== nova.titularId) campos.titular_id = velha.titularId;
    if (velha.backupId && velha.backupId !== nova.backupId) campos.backup_id = velha.backupId;
  }
  // Audiência com correspondente: ele segue como titular e a pessoa do escritório segue como backup.
  if (velha.correspondente?.trim() && !nova.correspondente?.trim()) {
    Object.assign(campos, { correspondente: velha.correspondente.trim(), titular_id: null, backup_id: velha.backupId ?? nova.titularId ?? null });
  }
  const de = NOME_DA_ORIGEM[velha.origem];
  const para = NOME_DA_ORIGEM[nova.origem];
  if (Object.keys(campos).length) {
    const { error } = await db().from("aud_audiencias").update(campos).eq("id", nova.id);
    if (error) falhou(`passar a audiência ${de} para a ${para}`, error);
  }
  const { data: convitesDaNova, error: erroConvites } = await db().from("aud_convites").select("papel").eq("audiencia_id", nova.id);
  if (erroConvites) falhou(`ler os convites da audiência ${para}`, erroConvites);
  const jaTem = ((convitesDaNova ?? []) as { papel: string }[]).map((c) => c.papel);
  const mover = ["titular", "backup"].filter((papel) => !jaTem.includes(papel));
  if (mover.length) {
    const { error: erroMover } = await db().from("aud_convites").update({ audiencia_id: nova.id }).eq("audiencia_id", velha.id).in("papel", mover);
    if (erroMover) falhou(`passar os convites ${de} para a audiência ${para}`, erroMover);
  }
  const { error } = await db()
    .from("aud_audiencias")
    .update({ situacao: "cancelada", mudanca_conferida_em: new Date().toISOString(), mudanca_conferida_por: `sistema: substituída pela audiência ${para}` })
    .eq("id", velha.id);
  if (error) falhou(`tirar da pauta a audiência ${de}`, error);
  await registrarHistorico(nova.id, `substituiu a ${de}`, { para: Object.keys(campos).join(", ") || null, feitoPor });
  await registrarHistorico(velha.id, `substituída pela ${para}`, { feitoPor });
}
