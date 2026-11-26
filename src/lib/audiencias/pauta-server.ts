import "server-only";

import { z } from "zod";
import { hojeEmBrasilia, proximosDiasUteis, somarDias } from "./agenda";
import { avisarCorrespondente, avisarTroca, ehDiaUtil } from "./avisos-server";
import { ORIGEM_AUTOMATICA, type ResumoConferenciaVios, type TarefaSoNoVios } from "./conferencia-server";
import { lerConfig, modoOutlook, modoWhatsapp } from "./config-server";
import { AudienciasError, carregarAudiencias, carregarPessoas, carregarPessoasComFotos, COLUNAS_AUDIENCIA, db, falhou, paraAudiencia, registrarHistorico, type Ator } from "./server";
import type { Audiencia, ConvitePauta, PessoaPauta } from "./tipos";

/** O que as telas pedem: pauta de um período, distribuição dos próximos dias úteis, troca e conferência. */

export type Convite = ConvitePauta;

export interface Leitura {
  fonte: string;
  tribunal: string | null;
  iniciadaEm: string;
  terminadaEm: string | null;
  total: number;
  erro: string | null;
}

/** A última conferência automática com o VIOS: números, erro (se a última falhou) e as tarefas só no VIOS. */
export interface ConferenciaVios {
  em: string | null;
  erro: string | null;
  resumo: ResumoConferenciaVios | null;
  soNoVios: TarefaSoNoVios[];
}

export interface DadosDaPauta {
  audiencias: Audiencia[];
  pessoas: PessoaPauta[];
  convites: Convite[];
  leituras: Leitura[];
  vios: ConferenciaVios | null;
  duracoes: Record<string, number>;
  modos: { outlook: string; whatsapp: string };
}

async function convitesDe(ids: string[]): Promise<Convite[]> {
  if (!ids.length) return [];
  const saida: Convite[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db().from("aud_convites").select("audiencia_id, papel, pessoa_id, status, resposta").in("audiencia_id", ids.slice(i, i + 300));
    if (error) falhou("ler os convites", error);
    for (const c of (data ?? []) as Record<string, string | null>[])
      saida.push({ audienciaId: c.audiencia_id!, papel: c.papel as Convite["papel"], pessoaId: c.pessoa_id, status: c.status!, resposta: c.resposta });
  }
  return saida;
}

/** A última leitura de cada fonte (e de cada tribunal no PJe). Uma consulta por fonte: o DJEN grava uma a cada 10 minutos. */
async function ultimasLeituras(): Promise<Leitura[]> {
  const fontes: [string, number][] = [
    ["pje", 20],
    ["djen", 1],
    ["vios", 1],
  ];
  const lidas = await Promise.all(
    fontes.map(([fonte, quantas]) =>
      db().from("aud_leituras").select("fonte, tribunal, iniciada_em, terminada_em, total, erro").eq("fonte", fonte).order("iniciada_em", { ascending: false }).limit(quantas)
    )
  );
  const vistas = new Set<string>();
  const saida: Leitura[] = [];
  for (const l of lidas.flatMap((r) => (r.data ?? []) as Record<string, unknown>[])) {
    const chave = `${l.fonte}:${l.tribunal ?? ""}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push({ fonte: String(l.fonte), tribunal: (l.tribunal as string | null) ?? null, iniciadaEm: String(l.iniciada_em), terminadaEm: (l.terminada_em as string | null) ?? null, total: Number(l.total ?? 0), erro: (l.erro as string | null) ?? null });
  }
  return saida;
}

async function ultimaConferenciaVios(): Promise<ConferenciaVios | null> {
  const { data } = await db()
    .from("aud_leituras")
    .select("iniciada_em, erro, detalhe")
    .eq("fonte", "vios")
    .eq("origem", ORIGEM_AUTOMATICA)
    .not("terminada_em", "is", null)
    .order("iniciada_em", { ascending: false })
    .limit(5);
  const linhas = (data ?? []) as { iniciada_em: string; erro: string | null; detalhe: (ResumoConferenciaVios & { soNoViosLista?: TarefaSoNoVios[] }) | null }[];
  if (!linhas.length) return null;
  const boa = linhas.find((l) => !l.erro && l.detalhe);
  const { soNoViosLista, ...resumo } = boa?.detalhe ?? { soNoViosLista: [] };
  return {
    em: boa?.iniciada_em ?? null,
    erro: linhas[0]!.erro,
    resumo: boa ? (resumo as ResumoConferenciaVios) : null,
    soNoVios: soNoViosLista ?? [],
  };
}

async function montar(audiencias: Audiencia[]): Promise<DadosDaPauta> {
  const [pessoas, convites, leituras, vios, config] = await Promise.all([
    carregarPessoasComFotos(),
    convitesDe(audiencias.map((a) => a.id)),
    ultimasLeituras(),
    ultimaConferenciaVios(),
    lerConfig(),
  ]);
  return { audiencias, pessoas, convites, leituras, vios, duracoes: config.duracoes as Record<string, number>, modos: { outlook: modoOutlook(), whatsapp: modoWhatsapp() } };
}

const esquemaPeriodo = z.object({ de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function pautaDoPeriodo(params: URLSearchParams): Promise<DadosDaPauta> {
  const hoje = hojeEmBrasilia();
  const lido = esquemaPeriodo.safeParse({ de: params.get("de") ?? hoje, ate: params.get("ate") ?? somarDias(hoje, 7) });
  if (!lido.success) throw new AudienciasError("Período inválido.", 400);
  const { de, ate } = lido.data;
  if (ate < de || somarDias(de, 120) < ate) throw new AudienciasError("O período vai de 1 a 120 dias.", 400);
  return montar(await carregarAudiencias(`${de}T00:00:00-03:00`, `${somarDias(ate, 1)}T00:00:00-03:00`));
}

/** A tela da reunião diária: hoje e os próximos dois dias úteis (com feriado no meio, pula). */
export async function dadosDaDistribuicao(): Promise<DadosDaPauta & { hoje: string; dias: string[] }> {
  const util = await ehDiaUtil();
  const hoje = hojeEmBrasilia();
  const dias = proximosDiasUteis(hoje, 2, util);
  const ultimo = dias[dias.length - 1] ?? somarDias(hoje, 1);
  return { ...(await montar(await carregarAudiencias(`${hoje}T00:00:00-03:00`, `${somarDias(ultimo, 1)}T00:00:00-03:00`))), hoje, dias };
}

async function umaAudiencia(id: string): Promise<Audiencia> {
  const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).eq("id", id).maybeSingle();
  if (error) falhou("ler a audiência", error);
  if (!data) throw new AudienciasError("Audiência não encontrada.", 404);
  return paraAudiencia(data as Record<string, unknown>);
}

const esquemaTroca = z.object({
  papel: z.enum(["titular", "backup"]),
  pessoaId: z.string().uuid(),
  motivo: z.string().trim().min(2, "Diga o motivo da troca.").max(200),
});

/** Atribui ou troca titular/backup. Fica no histórico e avisa no grupo; a rota refaz o convite logo depois de responder. */
export async function trocarPessoa(id: string, entrada: unknown, ator: Ator): Promise<Audiencia> {
  const lido = esquemaTroca.safeParse(entrada);
  if (!lido.success) throw new AudienciasError(lido.error.issues[0]?.message ?? "Troca inválida.", 400);
  const { papel, pessoaId, motivo } = lido.data;
  const aud = await umaAudiencia(id);
  if (aud.situacao !== "designada") throw new AudienciasError("Esta audiência não está mais designada no tribunal.", 409);
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  const nova = pessoas.get(pessoaId);
  if (!nova || !nova.ativo) throw new AudienciasError("Pessoa não encontrada na equipe da pauta.", 404);
  if (papel === "titular" && aud.correspondente?.trim())
    throw new AudienciasError(`Esta audiência é do correspondente ${aud.correspondente.trim()}: tire o correspondente para pôr alguém do escritório como titular.`, 409);
  const de = papel === "titular" ? aud.titularId : aud.backupId;
  if (de === pessoaId) return aud;
  const campos: Record<string, unknown> = papel === "titular" ? { titular_id: pessoaId } : { backup_id: pessoaId };
  // Quem era backup e virou titular deixa a vaga de backup.
  if (papel === "titular" && aud.backupId === pessoaId) campos.backup_id = null;
  if (papel === "backup" && aud.titularId === pessoaId) throw new AudienciasError("Essa pessoa já é a titular desta audiência.", 409);
  const { error } = await db().from("aud_audiencias").update(campos).eq("id", id);
  if (error) falhou("trocar a pessoa da audiência", error);
  await registrarHistorico(id, papel === "titular" ? "titular" : "backup", {
    de: de ? pessoas.get(de)?.nomeCurto ?? null : null,
    para: nova.nomeCurto,
    motivo,
    feitoPor: ator.nome,
  });
  const atualizada = await umaAudiencia(id);
  await avisarTroca(atualizada, papel, de, pessoaId, motivo);
  return atualizada;
}

const esquemaCampos = z.object({
  modalidadeEquipe: z.enum(["presencial", "video"]).nullable().optional(),
  correspondente: z.string().trim().max(160).nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
  linkSala: z.string().trim().url().max(500).nullable().optional(),
});

/** O que a equipe completa: como vai na híbrida, correspondente, observação e link quando o tribunal não deu. */
export async function completarAudiencia(id: string, entrada: unknown, ator: Ator): Promise<Audiencia> {
  const lido = esquemaCampos.safeParse(entrada);
  if (!lido.success) throw new AudienciasError(lido.error.issues[0]?.message ?? "Dados inválidos.", 400);
  const d = lido.data;
  const antes = await umaAudiencia(id);
  const campos: Record<string, unknown> = {};
  if (d.modalidadeEquipe !== undefined) campos.modalidade_equipe = d.modalidadeEquipe;
  if (d.observacao !== undefined) campos.observacao = d.observacao || null;
  if (d.linkSala !== undefined) Object.assign(campos, { link_sala: d.linkSala || null, link_fonte: d.linkSala ? "manual" : null, link_fonte_data: null });
  // Correspondente (contratação externa): ele vira o titular e a titular do escritório passa a backup. Tirando o
  // correspondente, a backup volta a titular (a backup anterior não volta sozinha: a coordenação escolhe de novo).
  const correspondenteAntes = antes.correspondente?.trim() || null;
  const correspondente = d.correspondente === undefined ? correspondenteAntes : d.correspondente?.trim() || null;
  const mudouCorrespondente = correspondente !== correspondenteAntes;
  if (mudouCorrespondente) {
    campos.correspondente = correspondente;
    if (correspondente && !correspondenteAntes && antes.titularId) Object.assign(campos, { titular_id: null, backup_id: antes.titularId });
    if (!correspondente && !antes.titularId && antes.backupId) Object.assign(campos, { titular_id: antes.backupId, backup_id: null });
  }
  if (!Object.keys(campos).length) return antes;
  const { error } = await db().from("aud_audiencias").update(campos).eq("id", id);
  if (error) falhou("completar a audiência", error);
  const outros = Object.keys(campos).filter((c) => !["correspondente", "titular_id", "backup_id"].includes(c));
  if (outros.length) await registrarHistorico(id, "completada", { para: outros.join(", "), feitoPor: ator.nome });
  if (mudouCorrespondente) await registrarHistorico(id, "correspondente", { de: correspondenteAntes, para: correspondente, feitoPor: ator.nome });
  const atualizada = await umaAudiencia(id);
  if (mudouCorrespondente) await avisarCorrespondente(atualizada, correspondenteAntes);
  return atualizada;
}

/** Marca como conferidas no VIOS as mudanças e cancelamentos vistos no tribunal. */
export async function conferirMudancas(entrada: unknown, ator: Ator): Promise<{ conferidas: number }> {
  const lido = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).safeParse(entrada);
  if (!lido.success) throw new AudienciasError("Diga quais audiências foram conferidas.", 400);
  const agora = new Date().toISOString();
  const { data, error } = await db()
    .from("aud_audiencias")
    .update({ mudanca_conferida_em: agora, mudanca_conferida_por: ator.nome })
    .in("id", lido.data.ids)
    .select("id");
  if (error) falhou("marcar como conferido", error);
  for (const l of (data ?? []) as { id: string }[]) await registrarHistorico(l.id, "conferida no VIOS", { feitoPor: ator.nome });
  return { conferidas: data?.length ?? 0 };
}

export async function historicoDaAudiencia(id: string) {
  const { data, error } = await db().from("aud_historico").select("acao, de, para, motivo, feito_por, em").eq("audiencia_id", id).order("em", { ascending: false }).limit(50);
  if (error) falhou("ler o histórico", error);
  return data ?? [];
}
