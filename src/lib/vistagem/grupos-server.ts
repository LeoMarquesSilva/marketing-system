import "server-only";

import { getSioeClient } from "@/lib/sioe-sync-server";
import { VistagemError } from "./errors";

export interface GrupoCliente {
  grupo: string;
  /** Pastas ativas do grupo no VIOS (a contagem diária do SIOE). */
  ativas: number;
}

let cache: { carregadoEm: number; grupos: GrupoCliente[] } | null = null;
const CACHE_MS = 30 * 60 * 1000;

/** Grupos de clientes do VIOS (contagem_ci_por_grupo do SIOE), em ordem alfabética, para o combo da controladoria. */
export async function listarGruposClientes(): Promise<GrupoCliente[]> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_MS) return cache.grupos;
  const db = getSioeClient();
  const grupos: GrupoCliente[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await db.from("contagem_ci_por_grupo").select("grupo_cliente, ativo").range(inicio, inicio + 999);
    if (error) throw new VistagemError(`Falha ao carregar os grupos de clientes: ${error.message}`, 502);
    for (const linha of (data ?? []) as { grupo_cliente: string | null; ativo: number | null }[]) {
      const grupo = linha.grupo_cliente?.trim();
      if (grupo) grupos.push({ grupo, ativas: linha.ativo ?? 0 });
    }
    if (!data || data.length < 1000) break;
  }
  grupos.sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR"));
  cache = { carregadoEm: Date.now(), grupos };
  return grupos;
}
