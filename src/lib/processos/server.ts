import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser, requireOperacoesLegaisAccess } from "@/lib/api-auth";
import { ProcessosError } from "./errors";

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
  throw new ProcessosError(`Não foi possível ${contexto}.`, 500);
}

/** Quem está agindo: id de auth e nome, para o histórico e a fila do VIOS. */
export interface Ator {
  authUserId: string;
  nome: string | null;
}

/** Por enquanto o módulo é de quem tem acesso a Operações Legais (hoje, só admin). */
export async function exigirAcessoProcessos(): Promise<Ator> {
  const user = await requireAuthenticatedUser();
  await requireOperacoesLegaisAccess(user.id);
  const { data } = await db().from("users").select("name").eq("auth_id", user.id).maybeSingle();
  return { authUserId: user.id, nome: (data?.name as string | null) ?? null };
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
