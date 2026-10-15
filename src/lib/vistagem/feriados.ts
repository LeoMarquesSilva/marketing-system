import "server-only";

import { getSioeClient } from "@/lib/sioe-sync-server";
import { feriadosNacionais } from "./dias-uteis";
import { VistagemError } from "./errors";

/**
 * Feriados da base do SIOE (sp_feriados, vinda do Feriados.xlsx da Controladoria).
 * Fica de fora o que não suspende prazo: "Posterga prazos? Não", datas só
 * comemorativas (Dia da Bandeira) e ponto facultativo que muitos fóruns não fecham
 * (Dia do Servidor Público): contar esses dias deixaria a data fatal mais tarde do que a real.
 * Para os anos que a base ainda não tem, entram os feriados nacionais calculados.
 * O recesso forense não entra aqui: é regra de contagem (criarCalendarioDePrazo).
 */
const NAO_SUSPENDE_PRAZO = /bandeira|servidor p[uú]blico/i;

/** Anos cobertos: do ano passado até daqui a dois (o atalho de 180 dias úteis passa de 8 meses). */
function anosCobertos(): number[] {
  const ano = new Date().getUTCFullYear();
  return [ano - 1, ano, ano + 1, ano + 2];
}

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
  const linhas = data ?? [];
  const datas = linhas
    .filter((row) => !/^\s*n[ãa]o/i.test(String(row.posterga_prazos ?? "")) && !NAO_SUSPENDE_PRAZO.test(String(row.nome ?? "")))
    .flatMap((row) => expandir(String(row.data).slice(0, 10), row.data_fim ? String(row.data_fim).slice(0, 10) : null));
  const anosNaBase = new Set(linhas.map((row) => Number(String(row.data).slice(0, 4))));
  const faltando = anosCobertos()
    .filter((ano) => !anosNaBase.has(ano))
    .flatMap(feriadosNacionais);
  cache = { carregadoEm: Date.now(), datas: [...new Set([...datas, ...faltando])].sort() };
  return cache.datas;
}
