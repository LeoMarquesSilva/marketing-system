import "server-only";

import { getSioeClient } from "@/lib/sioe-sync-server";
import { nomesDosFeriadosNacionais } from "./dias-uteis";
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

let cache: { carregadoEm: number; datas: string[]; nomes: Record<string, string> } | null = null;
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

/** Os feriados por dia, com o nome (o da planilha da Controladoria ou, nos anos sem ela, o do feriado nacional). */
async function carregarBase(): Promise<{ datas: string[]; nomes: Record<string, string> }> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_MS) return cache;
  const { data, error } = await getSioeClient().from("sp_feriados").select("data, data_fim, nome, posterga_prazos");
  if (error) throw new VistagemError(`Falha ao carregar os feriados do SIOE: ${error.message}`, 502);
  const linhas = data ?? [];
  const nomes: Record<string, string> = {};
  const suspendem = linhas.filter(
    (row) => !/^\s*n[ãa]o/i.test(String(row.posterga_prazos ?? "")) && !NAO_SUSPENDE_PRAZO.test(String(row.nome ?? ""))
  );
  for (const row of suspendem) {
    for (const dia of expandir(String(row.data).slice(0, 10), row.data_fim ? String(row.data_fim).slice(0, 10) : null)) {
      nomes[dia] = String(row.nome ?? "").trim() || "Feriado";
    }
  }
  const anosNaBase = new Set(linhas.map((row) => Number(String(row.data).slice(0, 4))));
  for (const ano of anosCobertos().filter((ano) => !anosNaBase.has(ano))) {
    for (const [dia, nome] of Object.entries(nomesDosFeriadosNacionais(ano))) nomes[dia] ??= nome;
  }
  cache = { carregadoEm: Date.now(), datas: Object.keys(nomes).sort(), nomes };
  return cache;
}

export async function carregarFeriados(): Promise<string[]> {
  return (await carregarBase()).datas;
}

/** Os mesmos dias de `carregarFeriados`, com o nome (para o informativo do calendário). */
export async function carregarNomesDosFeriados(): Promise<Record<string, string>> {
  return (await carregarBase()).nomes;
}
