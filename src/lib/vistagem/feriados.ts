import "server-only";

import { getSioeClient } from "@/lib/sioe-sync-server";
import { VistagemError } from "./errors";

/**
 * Feriados da base do SIOE (sp_feriados, vinda do Feriados.xlsx da Controladoria).
 * Fica de fora o que não suspende prazo: "Posterga prazos? Não" e datas só
 * comemorativas (Dia da Bandeira), que deixariam a data fatal mais tarde do que a real.
 */
const NAO_SUSPENDE_PRAZO = /bandeira/i;

let cache: { carregadoEm: number; datas: string[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

function expandir(inicio: string, fim: string | null): string[] {
  const datas: string[] = [];
  const atual = new Date(`${inicio}T12:00:00Z`);
  const ultimo = new Date(`${fim ?? inicio}T12:00:00Z`);
  for (let i = 0; atual <= ultimo && i < 60; i += 1) {
    datas.push(atual.toISOString().slice(0, 10));
    atual.setUTCDate(atual.getUTCDate() + 1);
  }
  return datas;
}

export async function carregarFeriados(): Promise<string[]> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_MS) return cache.datas;
  const { data, error } = await getSioeClient().from("sp_feriados").select("data, data_fim, nome, posterga_prazos");
  if (error) throw new VistagemError(`Falha ao carregar os feriados do SIOE: ${error.message}`, 502);
  const datas = (data ?? [])
    .filter((row) => !/^\s*n[ãa]o/i.test(String(row.posterga_prazos ?? "")) && !NAO_SUSPENDE_PRAZO.test(String(row.nome ?? "")))
    .flatMap((row) => expandir(String(row.data).slice(0, 10), row.data_fim ? String(row.data_fim).slice(0, 10) : null));
  cache = { carregadoEm: Date.now(), datas: [...new Set(datas)].sort() };
  return cache.datas;
}
