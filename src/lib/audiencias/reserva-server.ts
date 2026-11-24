import "server-only";

import { hojeEmBrasilia, local, somarDias } from "./agenda";
import { lidoAtePorTribunal, tribunalDoCnj } from "./conferencia-vios";
import { duplaDaPasta } from "./duplas";
import { passarParaOTribunal } from "./jusbr-server";
import { pastasPorCnj } from "./pastas-server";
import {
  DIAS_DA_RESERVA,
  itemDaVistagem,
  juntarReservas,
  motivoParaSair,
  noHorizonte,
  reservasComTribunal,
  reservasDoVios,
  type AgendamentoDeAudiencia,
  type ItemDeReserva,
} from "./reserva";
import { carregarPessoas, COLUNAS_AUDIENCIA, db, falhou, paraAudiencia, registrarHistorico } from "./server";
import type { Audiencia } from "./tipos";
import type { AudienciaNoVios } from "./vios-csv";

/**
 * Rede de segurança da pauta (parte com banco; regras em reserva.ts). Roda dentro da conferência com o VIOS, que já
 * tem as tarefas do VIOS e sabe quais casaram com audiências do tribunal: põe na pauta "a confirmar" o que só o VIOS
 * ou a Vistagem têm, acerta as que mudaram, tira as que saíram do VIOS e passa para o tribunal as que ele confirmou.
 */

export interface ResumoReservas {
  novas: number;
  daVistagem: number;
  atualizadas: number;
  canceladas: number;
  substituidas: number;
}

type Linha = Record<string, unknown>;

const FEITO_POR = "conferência com o VIOS";
const TAREFAS_DE_AUDIENCIA = "tarefa.ilike.*AUD*,tarefa.ilike.*SESS*,tarefa.ilike.*PER*CIA*";
const COLUNAS_AGENDAMENTO = "id, tarefa, data, data_limite, hora, vios_tarefa_id, vistagem_publicacoes(numero_processo, area_processo, pasta_ci)";

function paraAgendamento(l: Linha): AgendamentoDeAudiencia {
  const bruto = l.vistagem_publicacoes;
  const pub = (Array.isArray(bruto) ? bruto[0] : bruto) as Linha | null | undefined;
  return {
    id: String(l.id),
    tarefa: String(l.tarefa ?? ""),
    data: String(l.data ?? ""),
    dataLimite: (l.data_limite as string | null) ?? null,
    hora: (l.hora as string | null) ?? null,
    viosTarefaCi: l.vios_tarefa_id ? String(l.vios_tarefa_id) : null,
    cnj: (pub?.numero_processo as string | null) ?? null,
    area: (pub?.area_processo as string | null) ?? null,
    ciProcesso: pub?.pasta_ci ? String(pub.pasta_ci) : null,
  };
}

/** Agendamentos de audiência, sessão e perícia da Vistagem entre `de` e `ate`, mais os de `ids` (já na pauta). */
async function agendamentosDaVistagem(de: string, ate: string, ids: string[]): Promise<AgendamentoDeAudiencia[]> {
  const { data, error } = await db().from("vistagem_agendamentos").select(COLUNAS_AGENDAMENTO).gte("data", de).lte("data", ate).or(TAREFAS_DE_AUDIENCIA).limit(3000);
  if (error) falhou("ler os agendamentos da Vistagem", error);
  const linhas = (data ?? []) as Linha[];
  const lidos = new Set(linhas.map((l) => String(l.id)));
  const faltam = ids.filter((id) => !lidos.has(id));
  for (let i = 0; i < faltam.length; i += 200) {
    const { data: mais, error: erro } = await db().from("vistagem_agendamentos").select(COLUNAS_AGENDAMENTO).in("id", faltam.slice(i, i + 200));
    if (erro) falhou("ler os agendamentos da Vistagem", erro);
    linhas.push(...((mais ?? []) as Linha[]));
  }
  return linhas.map(paraAgendamento);
}

function mesmoInstante(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  return Date.parse(a) === Date.parse(b);
}

/** O que mudou entre a audiência "a confirmar" e o item que a fonte traz agora. */
function camposQueMudaram(a: Audiencia, item: ItemDeReserva): Linha {
  const campos: Linha = {};
  if (a.chave !== item.chave) campos.chave = item.chave;
  if (!mesmoInstante(a.inicio, item.inicio)) campos.inicio = item.inicio;
  if (a.tipo !== item.tipo) campos.tipo = item.tipo;
  if (a.tipoDescricao !== item.tipoDescricao) campos.tipo_descricao = item.tipoDescricao;
  if (!a.modalidadeTribunal && item.modalidade) campos.modalidade_tribunal = item.modalidade;
  if (a.situacao !== "designada") Object.assign(campos, { situacao: "designada", mudanca_conferida_em: null, mudanca_conferida_por: null });
  if ((a.viosTarefaCi ?? null) !== item.viosTarefaCi) campos.vios_tarefa_ci = item.viosTarefaCi;
  if (!mesmoInstante(a.viosInicio, item.viosInicio)) campos.vios_inicio = item.viosInicio;
  const situacaoNoVios = item.viosTarefaCi ? "aberta" : null;
  if ((a.viosSituacao ?? null) !== situacaoNoVios) campos.vios_situacao = situacaoNoVios;
  return campos;
}

function quando(iso: string): string {
  const { dia, hora } = local(iso);
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}${hora === "00:00" ? "" : ` ${hora}`}`;
}

export async function sincronizarReservas(entrada: {
  /** Tarefas de audiência do VIOS (todas as fontes juntas, de qualquer situação). */
  tarefas: AudienciaNoVios[];
  /** Da conferência: para cada audiência do tribunal, a tarefa do VIOS que casou com ela. */
  tarefaDa: Map<string, AudienciaNoVios | null>;
  /** A pauta de hoje em diante (tribunal e "a confirmar"). */
  audiencias: Audiencia[];
  /** O Audiencias.csv (completo) foi lido: tarefa que não veio foi apagada no VIOS. */
  relatorioCompleto: boolean;
  agora?: Date;
}): Promise<ResumoReservas> {
  const agora = entrada.agora ?? new Date();
  const hoje = hojeEmBrasilia(agora);
  const resumo: ResumoReservas = { novas: 0, daVistagem: 0, atualizadas: 0, canceladas: 0, substituidas: 0 };
  const porId = new Map(entrada.audiencias.map((a) => [a.id, a]));
  const tribunal = entrada.audiencias.filter((a) => a.origem !== "vios");
  const tribunalDaTarefa = new Map<string, Audiencia>();
  for (const [id, t] of entrada.tarefaDa) {
    const a = porId.get(id);
    if (t && a && a.origem !== "vios") tribunalDaTarefa.set(t.tarefaCi, a);
  }
  const tarefasPorCi = new Map(entrada.tarefas.map((t) => [t.tarefaCi, t]));
  const crit = { hoje, lidoAte: lidoAtePorTribunal(tribunal) };

  // 1. O tribunal passou a mostrar: a dele vale e herda a dupla.
  const pares = reservasComTribunal(entrada.audiencias, tribunalDaTarefa);
  for (const { reserva, tribunal: doTribunal } of pares) await passarParaOTribunal(reserva, doTribunal, FEITO_POR);
  resumo.substituidas = pares.length;
  const substituidas = new Set(pares.map((p) => p.reserva.id));

  // 2. O que deve estar na pauta agora.
  const existentes = entrada.audiencias.filter((a) => a.origem === "vios" && !substituidas.has(a.id));
  const idsNaPauta = existentes.filter((a) => a.chave.startsWith("vistagem:")).map((a) => a.chave.slice("vistagem:".length));
  const agendamentos = await agendamentosDaVistagem(somarDias(hoje, -10), somarDias(hoje, DIAS_DA_RESERVA), idsNaPauta);
  const agendamentoPorId = new Map(agendamentos.map((a) => [a.id, a]));
  const daVistagem = agendamentos
    .map(itemDaVistagem)
    .filter((i): i is ItemDeReserva => Boolean(i))
    // A tarefa já está no VIOS: vale o que o VIOS diz dela (casou com o tribunal, foi concluída...).
    .filter((i) => !i.viosTarefaCi || !tarefasPorCi.has(i.viosTarefaCi))
    .filter((i) => noHorizonte(i, crit));
  const itens = juntarReservas(reservasDoVios(entrada.tarefas, new Set(tribunalDaTarefa.keys()), crit), daVistagem, tribunal);
  const itemPorChave = new Map(itens.map((i) => [i.chave, i]));

  // 3. As que já estão na pauta: acertar, trocar a chave (o agendamento ganhou a CI do VIOS) ou tirar.
  const chavesNaPauta = new Set(existentes.map((a) => a.chave));
  const tratadas = new Set<string>();
  for (const a of existentes) {
    let item = itemPorChave.get(a.chave);
    if (!item && a.chave.startsWith("vistagem:")) {
      const ci = agendamentoPorId.get(a.chave.slice("vistagem:".length))?.viosTarefaCi;
      const novaChave = ci ? `vios:${ci}` : null;
      if (novaChave && !chavesNaPauta.has(novaChave)) item = itemPorChave.get(novaChave);
    }
    if (item && !tratadas.has(item.chave)) {
      tratadas.add(item.chave);
      const campos = camposQueMudaram(a, item);
      if (!Object.keys(campos).length) continue;
      const { error } = await db()
        .from("aud_audiencias")
        .update({ ...campos, lida_em: agora.toISOString() })
        .eq("id", a.id);
      if (error) falhou("acertar a audiência a confirmar", error);
      resumo.atualizadas += 1;
      if (campos.inicio || campos.situacao)
        await registrarHistorico(a.id, campos.situacao ? "voltou para a pauta" : "mudou no VIOS", { de: campos.inicio ? a.inicio : null, para: campos.inicio ? String(campos.inicio) : item.tipoDescricao, feitoPor: FEITO_POR });
      continue;
    }
    const ciDoAgendamento = a.chave.startsWith("vistagem:") ? agendamentoPorId.get(a.chave.slice("vistagem:".length))?.viosTarefaCi : null;
    const motivo =
      ciDoAgendamento && chavesNaPauta.has(`vios:${ciDoAgendamento}`) && a.situacao === "designada"
        ? "a tarefa do VIOS já está na pauta"
        : motivoParaSair(a, { tarefasPorCi, agendamentos: new Set(agendamentoPorId.keys()), relatorioCompleto: entrada.relatorioCompleto, agora });
    if (!motivo) continue;
    const { error } = await db()
      .from("aud_audiencias")
      .update({ situacao: "cancelada", mudanca_conferida_em: agora.toISOString(), mudanca_conferida_por: `sistema: ${motivo}` })
      .eq("id", a.id);
    if (error) falhou("tirar da pauta a audiência a confirmar", error);
    await registrarHistorico(a.id, "saiu da pauta", { para: motivo, feitoPor: FEITO_POR });
    resumo.canceladas += 1;
  }

  // 4. As novas. A chave é única: a que já existe fora da pauta lida (ex.: cancelada antes) volta em vez de duplicar.
  const novos = itens.filter((i) => !tratadas.has(i.chave));
  if (!novos.length) return resumo;
  const jaExistem = new Map<string, Audiencia>();
  for (let i = 0; i < novos.length; i += 150) {
    const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).in("chave", novos.slice(i, i + 150).map((n) => n.chave));
    if (error) falhou("ler as audiências a confirmar", error);
    for (const l of (data ?? []) as Linha[]) {
      const a = paraAudiencia(l);
      jaExistem.set(a.chave, a);
    }
  }
  const pessoas = await carregarPessoas();
  const pastas = await pastasPorCnj(novos.filter((i) => !jaExistem.has(i.chave)).map((i) => i.cnj));
  for (const item of novos) {
    const antiga = jaExistem.get(item.chave);
    if (antiga) {
      const campos = camposQueMudaram(antiga, item);
      if (!Object.keys(campos).length) continue;
      const { error } = await db()
        .from("aud_audiencias")
        .update({ ...campos, lida_em: agora.toISOString() })
        .eq("id", antiga.id);
      if (error) falhou("acertar a audiência a confirmar", error);
      resumo.atualizadas += 1;
      if (campos.situacao) await registrarHistorico(antiga.id, "voltou para a pauta", { para: `${quando(item.inicio)} · ${item.tipoDescricao}`, feitoPor: FEITO_POR });
      continue;
    }
    const pasta = pastas.get(item.cnj);
    const dupla = pasta ? duplaDaPasta(pessoas, { advogadoResponsavel: pasta.advogadoResponsavel, auxiliarSigla: pasta.auxiliarSigla }) : { titularId: null, backupId: null };
    const { data, error } = await db()
      .from("aud_audiencias")
      .insert({
        chave: item.chave,
        origem: "vios",
        tribunal: tribunalDoCnj(item.cnj),
        cnj: item.cnj,
        inicio: item.inicio,
        tipo: item.tipo,
        tipo_descricao: item.tipoDescricao,
        modalidade_tribunal: item.modalidade,
        situacao: "designada",
        cliente: pasta?.cliente ?? null,
        grupo_cliente: pasta?.grupoCliente ?? null,
        ci_processo: pasta?.ci ?? item.ciProcesso,
        titular_id: dupla.titularId,
        backup_id: dupla.backupId,
        vios_tarefa_ci: item.viosTarefaCi,
        vios_inicio: item.viosInicio,
        vios_situacao: item.viosTarefaCi ? "aberta" : null,
        lida_em: agora.toISOString(),
      })
      .select("id")
      .single();
    if (error) falhou("pôr na pauta a audiência a confirmar", error);
    resumo.novas += 1;
    if (item.fonte === "vistagem") resumo.daVistagem += 1;
    if (data)
      await registrarHistorico(String(data.id), item.fonte === "vios" ? "incluída pelo VIOS" : "incluída pela Vistagem", {
        para: `${quando(item.inicio)} · ${item.tipoDescricao}${item.viosTarefaCi ? ` · CI ${item.viosTarefaCi}` : ""}`,
        feitoPor: FEITO_POR,
      });
  }
  return resumo;
}
