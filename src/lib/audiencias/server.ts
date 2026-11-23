import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser, requirePautaAccess } from "@/lib/api-auth";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { pessoasPorNome } from "@/lib/vistagem/pessoas-server";
import type { Audiencia, Modalidade, Mudanca, PessoaPauta } from "./tipos";

/** Erro com status HTTP, como o de Processos. */
export class AudienciasError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "AudienciasError";
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
let cliente: SupabaseClient | null = null;

/** Service role: as tabelas aud_* não têm policy, todo acesso passa por aqui depois do gate. */
export function db(): SupabaseClient {
  if (!supabaseUrl || !serviceKey) throw new AudienciasError("Supabase não configurado no servidor.", 500);
  cliente ??= createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  return cliente;
}

export function falhou(contexto: string, erro: { message: string } | null): never {
  console.error(`[pauta] ${contexto}:`, erro?.message);
  throw new AudienciasError(`Não foi possível ${contexto}.`, 500);
}

export interface Ator {
  authUserId: string;
  nome: string | null;
  admin: boolean;
}

/** Pauta de Audiências: admin ou liberação da Pauta em Usuários (advogados, coordenação, controladoria). */
export async function exigirAcessoPauta(): Promise<Ator> {
  const user = await requireAuthenticatedUser();
  const { admin } = await requirePautaAccess(user.id);
  const { data } = await db().from("users").select("name").eq("auth_id", user.id).maybeSingle();
  return { authUserId: user.id, nome: (data?.name as string | null) ?? null, admin };
}

export function exigirAdmin(ator: Ator): void {
  if (!ator.admin) throw new AudienciasError("Só administradores mudam as configurações da pauta.", 403);
}

/* ------------------------------------------------------------------ linhas do banco */

export const COLUNAS_AUDIENCIA =
  "id, chave, origem, tribunal, cnj, inicio, fim, tipo, tipo_descricao, rito_sumarissimo, modalidade_tribunal, modalidade_equipe, orgao, sala, juizo_digital, situacao, link_sala, link_fonte, link_fonte_data, link_anterior, cliente, grupo_cliente, ci_processo, reclamante_iniciais, titular_id, backup_id, substitui_id, mudancas, mudanca_conferida_em, vios_inicio, vios_situacao, vios_tarefa_ci, vios_conferido_em, djen_conferido_em, djen_data, djen_inicio, djen_modalidade, correspondente, observacao, lida_em";

type Linha = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

export function paraAudiencia(l: Linha): Audiencia {
  return {
    id: String(l.id),
    chave: String(l.chave),
    origem: l.origem as Audiencia["origem"],
    tribunal: s(l.tribunal),
    cnj: String(l.cnj),
    inicio: new Date(String(l.inicio)).toISOString(),
    fim: l.fim ? new Date(String(l.fim)).toISOString() : null,
    tipo: l.tipo as Audiencia["tipo"],
    tipoDescricao: s(l.tipo_descricao),
    ritoSumarissimo: Boolean(l.rito_sumarissimo),
    modalidadeTribunal: (l.modalidade_tribunal as Modalidade | null) ?? null,
    modalidadeEquipe: (l.modalidade_equipe as Audiencia["modalidadeEquipe"]) ?? null,
    orgao: s(l.orgao),
    sala: s(l.sala),
    juizoDigital: (l.juizo_digital as boolean | null) ?? null,
    situacao: l.situacao as Audiencia["situacao"],
    linkSala: s(l.link_sala),
    linkFonte: (l.link_fonte as Audiencia["linkFonte"]) ?? null,
    linkFonteData: s(l.link_fonte_data),
    linkAnterior: s(l.link_anterior),
    cliente: s(l.cliente),
    grupoCliente: s(l.grupo_cliente),
    ciProcesso: s(l.ci_processo),
    reclamanteIniciais: s(l.reclamante_iniciais),
    titularId: s(l.titular_id),
    backupId: s(l.backup_id),
    substituiId: s(l.substitui_id),
    mudancas: ((l.mudancas as string[] | null) ?? []) as Mudanca[],
    mudancaConferidaEm: s(l.mudanca_conferida_em),
    viosInicio: l.vios_inicio ? new Date(String(l.vios_inicio)).toISOString() : null,
    viosSituacao: s(l.vios_situacao),
    viosTarefaCi: s(l.vios_tarefa_ci),
    viosConferidoEm: l.vios_conferido_em ? new Date(String(l.vios_conferido_em)).toISOString() : null,
    djenConferidoEm: s(l.djen_conferido_em),
    djenData: s(l.djen_data),
    djenInicio: l.djen_inicio ? new Date(String(l.djen_inicio)).toISOString() : null,
    djenModalidade: (l.djen_modalidade as Modalidade | null) ?? null,
    correspondente: s(l.correspondente),
    observacao: s(l.observacao),
    lidaEm: String(l.lida_em),
  };
}

export const COLUNAS_PESSOA = "id, nome_vios, nome_curto, sigla, user_id, email, whatsapp, cargo, faz_audiencia, coordenacao, ativo";

export function paraPessoa(l: Linha): PessoaPauta {
  return {
    id: String(l.id),
    nomeVios: String(l.nome_vios),
    nomeCurto: String(l.nome_curto),
    sigla: s(l.sigla),
    userId: s(l.user_id),
    email: s(l.email),
    whatsapp: s(l.whatsapp),
    cargo: s(l.cargo),
    fazAudiencia: Boolean(l.faz_audiencia),
    coordenacao: Boolean(l.coordenacao),
    ativo: Boolean(l.ativo),
  };
}

export async function carregarPessoas(): Promise<PessoaPauta[]> {
  const { data, error } = await db().from("aud_pessoas").select(COLUNAS_PESSOA).order("nome_vios");
  if (error) falhou("carregar as pessoas da pauta", error);
  return ((data ?? []) as Linha[]).map(paraPessoa);
}

/**
 * As pessoas da pauta com a foto, para as telas (as rotinas e os avisos usam carregarPessoas, sem foto). A foto vem
 * do mesmo lugar da vistagem e de Processos (RH, organograma e cadastro de usuários, pelo nome); se essa busca falhar,
 * as telas mostram as iniciais.
 */
export async function carregarPessoasComFotos(): Promise<PessoaPauta[]> {
  const pessoas = await carregarPessoas();
  try {
    const { fotos } = await pessoasPorNome(pessoas.map((p) => p.nomeVios));
    return pessoas.map((p) => ({ ...p, foto: fotos[chaveNome(p.nomeVios)] ?? null }));
  } catch (erro) {
    console.error("[pauta] fotos da equipe:", erro instanceof Error ? erro.message : erro);
    return pessoas;
  }
}

export async function carregarAudiencias(de: string, ate: string): Promise<Audiencia[]> {
  const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).gte("inicio", de).lt("inicio", ate).order("inicio").limit(3000);
  if (error) falhou("carregar a pauta", error);
  return ((data ?? []) as Linha[]).map(paraAudiencia);
}

export async function registrarHistorico(
  audienciaId: string,
  acao: string,
  dados: { de?: string | null; para?: string | null; motivo?: string | null; feitoPor?: string | null } = {}
): Promise<void> {
  const { error } = await db()
    .from("aud_historico")
    .insert({ audiencia_id: audienciaId, acao, de: dados.de ?? null, para: dados.para ?? null, motivo: dados.motivo ?? null, feito_por: dados.feitoPor ?? null });
  if (error) console.error("[pauta] histórico:", error.message);
}
