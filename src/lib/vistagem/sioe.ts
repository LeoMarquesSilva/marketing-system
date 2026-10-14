import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSioeClient } from "@/lib/sioe-sync-server";
import { VistagemError } from "./errors";
import { mascararCnj } from "./processo";
import { chavePessoa, type PastaSioe } from "./triagem";

/**
 * Base de processos e de pessoas do SIOE: processos_completo é atualizada todo
 * dia a partir do VIOS; sp_usuarios_area e colaboradores dão a área de cada pessoa.
 */
function sioe(): SupabaseClient {
  try {
    return getSioeClient();
  } catch (erro) {
    throw new VistagemError(`SIOE não configurado: ${erro instanceof Error ? erro.message : erro}`, 500);
  }
}

const COLUNAS = "ci, nro_cnj, vinculo, cliente, grupo_cliente, area, advogado_responsavel, situacao_processo, etiquetas";

type ProcessoRow = {
  ci: string | number;
  nro_cnj: string | null;
  vinculo: string | null;
  cliente: string | null;
  grupo_cliente: string | null;
  area: string | null;
  advogado_responsavel: string | null;
  situacao_processo: string | null;
  etiquetas: string | null;
};

function paraPasta(row: ProcessoRow): PastaSioe {
  return {
    ci: String(row.ci),
    cnj: row.nro_cnj ?? "",
    vinculo: row.vinculo?.trim() || null,
    cliente: row.cliente,
    grupoCliente: row.grupo_cliente,
    area: row.area,
    advogadoResponsavel: row.advogado_responsavel,
    situacao: row.situacao_processo,
    etiquetas: row.etiquetas,
  };
}

/** Pastas do SIOE por CNJ (20 dígitos). Um CNJ pode ter mais de uma pasta. */
export async function buscarPastasPorCnj(digitos: string[]): Promise<Map<string, PastaSioe[]>> {
  const db = sioe();
  const unicos = [...new Set(digitos.filter((d) => d.length === 20))];
  const resultado = new Map<string, PastaSioe[]>();
  for (let i = 0; i < unicos.length; i += 80) {
    const { data, error } = await db
      .from("processos_completo")
      .select(COLUNAS)
      .in("nro_cnj", unicos.slice(i, i + 80).map(mascararCnj));
    if (error) throw new VistagemError(`Falha ao consultar processos no SIOE: ${error.message}`, 502);
    for (const row of (data ?? []) as ProcessoRow[]) {
      const chave = String(row.nro_cnj ?? "").replace(/\D/g, "").slice(0, 20);
      const lista = resultado.get(chave) ?? [];
      if (!lista.some((pasta) => pasta.ci === String(row.ci))) lista.push(paraPasta(row));
      resultado.set(chave, lista);
    }
  }
  return resultado;
}

export async function buscarPastaPorCi(ci: string): Promise<PastaSioe | null> {
  const numero = ci.replace(/\D/g, "");
  if (!numero) return null;
  const { data, error } = await sioe().from("processos_completo").select(COLUNAS).eq("ci", numero).limit(1);
  if (error) throw new VistagemError(`Falha ao consultar a pasta no SIOE: ${error.message}`, 502);
  const [row] = (data ?? []) as ProcessoRow[];
  return row ? paraPasta(row) : null;
}

/** Área de cada pessoa: sp_usuarios_area e, para quem não está lá, colaboradores. */
export async function carregarAreasDasPessoas(): Promise<(nome: string | null) => string | null> {
  const db = sioe();
  const areas = new Map<string, string>();
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await db.from("sp_usuarios_area").select("nome, area").range(inicio, inicio + 999);
    if (error) throw new VistagemError(`Falha ao carregar as áreas das pessoas no SIOE: ${error.message}`, 502);
    for (const row of data ?? []) if (row.nome && row.area) areas.set(chavePessoa(row.nome), row.area);
    if (!data || data.length < 1000) break;
  }
  const { data: colaboradores, error } = await db.from("colaboradores").select("full_name, area");
  if (error) throw new VistagemError(`Falha ao carregar colaboradores no SIOE: ${error.message}`, 502);
  for (const row of colaboradores ?? []) {
    const chave = chavePessoa(row.full_name);
    if (row.area && !areas.has(chave)) areas.set(chave, row.area);
  }
  return (nome) => (nome ? areas.get(chavePessoa(nome)) ?? null : null);
}
