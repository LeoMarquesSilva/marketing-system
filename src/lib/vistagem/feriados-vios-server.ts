import "server-only";

import type { FeriadoDoVios } from "./feriados-vios";
import { sama } from "./sama";

/**
 * Feriados do VIOS copiados pelo robô (vios_feriados no SAMA, relidos a cada catálogo). Sem a tabela ou sem resposta,
 * volta vazio: a trava das datas fica só com os feriados do SIOE e os nacionais, como antes.
 */
let cache: { carregadoEm: number; feriados: FeriadoDoVios[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

interface LinhaFeriado {
  id: number;
  data_inicio: string;
  data_fim: string | null;
  nome: string | null;
  posterga_processuais: boolean | null;
  jurisdicoes: string[] | null;
  estados: string[] | null;
}

export async function carregarFeriadosVios(): Promise<FeriadoDoVios[]> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_MS) return cache.feriados;
  try {
    const { data, error } = await sama()
      .from("vios_feriados")
      .select("id, data_inicio, data_fim, nome, posterga_processuais, jurisdicoes, estados")
      .limit(5000)
      .returns<LinhaFeriado[]>();
    if (error) throw new Error(error.message);
    const feriados = (data ?? []).map(
      (linha): FeriadoDoVios => ({
        id: Number(linha.id),
        dataInicio: String(linha.data_inicio).slice(0, 10),
        dataFim: String(linha.data_fim ?? linha.data_inicio).slice(0, 10),
        nome: linha.nome,
        postergaProcessuais: linha.posterga_processuais === true,
        jurisdicoes: Array.isArray(linha.jurisdicoes) && linha.jurisdicoes.length ? linha.jurisdicoes : null,
        estados: Array.isArray(linha.estados) && linha.estados.length ? linha.estados : null,
      })
    );
    cache = { carregadoEm: Date.now(), feriados };
    return feriados;
  } catch (erro) {
    console.error("[vistagem] feriados do VIOS", erro instanceof Error ? erro.message : erro);
    return [];
  }
}
