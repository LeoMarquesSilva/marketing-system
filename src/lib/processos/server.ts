import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser, requireProcessosAccess } from "@/lib/api-auth";
import { ProcessosError } from "./errors";
import { ehTrabalhista } from "./trabalhista";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let cliente: SupabaseClient | null = null;

/** Service role: as tabelas proc_* não têm policy, todo acesso passa por aqui depois do gate. */
export function db(): SupabaseClient {
  if (!supabaseUrl || !serviceKey) throw new ProcessosError("Supabase não configurado no servidor.", 500);
  cliente ??= createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  return cliente;
}

export function falhou(contexto: string, erro: { message: string } | null): never {
  console.error(`[processos] ${contexto}:`, erro?.message);
  throw new ProcessosError(`Não foi possível ${contexto}.`, 500, erro?.message ?? null);
}

/** Quem está agindo: id de auth e nome, para o histórico e a fila do VIOS. */
export interface Ator {
  authUserId: string;
  nome: string | null;
  /** E-mail da sessão (a caixa do Microsoft 365 de quem está logado, para o envio pelo Outlook). */
  email?: string | null;
  /** Liberação só da Carteira Trabalhista: as rotas só aceitam processos da área. */
  soTrabalhista?: boolean;
}

/**
 * Processos e Pessoas: admin ou quem tem a liberação de Processos em Usuários. Com `trabalhista`, entra também
 * quem tem só a Carteira Trabalhista (`soTrabalhista`); a rota então confere o alvo com conferirAlvoTrabalhista.
 */
export async function exigirAcessoProcessos(opcoes: { trabalhista?: boolean } = {}): Promise<Ator> {
  const user = await requireAuthenticatedUser();
  const nivel = await requireProcessosAccess(user.id, opcoes);
  const { data } = await db().from("users").select("name").eq("auth_id", user.id).maybeSingle();
  return { authUserId: user.id, nome: (data?.name as string | null) ?? null, email: user.email ?? null, soTrabalhista: nivel === "trabalhista" };
}

/** Itens da ficha que a liberação da Trabalhista mexe, pela tabela onde estão (todas têm processo_id). */
const TABELA_DO_ITEM = {
  parte: "proc_partes",
  documento: "proc_documentos",
  pedido_autos: "proc_autos_pedidos",
  sugestao: "proc_sugestoes",
  afastamento: "proc_trab_afastamentos",
  pedido: "proc_trab_pedidos",
} as const;

/**
 * O que uma rota aberta à liberação da Trabalhista toca: a carteira inteira (já filtrada na área), um ou mais
 * processos, ou um item de um processo.
 */
export type AlvoTrabalhista = "carteira" | { processo: string } | { processos: string[] } | { item: keyof typeof TABELA_DO_ITEM; id: string };

/** Para quem tem só a Carteira Trabalhista: recusa o que não for de processo da área Trabalhista. */
export async function conferirAlvoTrabalhista(ator: Ator, alvo: AlvoTrabalhista): Promise<void> {
  if (!ator.soTrabalhista || alvo === "carteira") return;
  let ids: string[];
  if ("processo" in alvo) ids = [alvo.processo];
  else if ("processos" in alvo) ids = [...new Set(alvo.processos)];
  else {
    const { data, error } = await db().from(TABELA_DO_ITEM[alvo.item]).select("processo_id").eq("id", alvo.id).maybeSingle();
    if (error) falhou("conferir o item", error);
    if (!data) throw new ProcessosError("Item não encontrado.", 404);
    ids = [data.processo_id as string];
  }
  if (!ids.length) return;
  if (ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw new ProcessosError("Processo não encontrado.", 404);
  const { data, error } = await db().from("proc_processos").select("id, area").in("id", ids);
  if (error) falhou("conferir o processo", error);
  const trabalhistas = new Set((data ?? []).filter((linha) => ehTrabalhista(linha.area as string | null)).map((linha) => linha.id as string));
  if (ids.some((id) => !trabalhistas.has(id))) {
    throw new ProcessosError("Sem permissão para este processo: a sua liberação é só da Carteira Trabalhista.", 403);
  }
}

/** PROCESSOS_VIOS_MODO=real liga a gravação de verdade; qualquer outro valor só simula. */
export function gravacaoSimulada(): boolean {
  return process.env.PROCESSOS_VIOS_MODO?.trim().toLowerCase() !== "real";
}

export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}
