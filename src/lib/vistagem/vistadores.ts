import type { ESCRITORIOS } from "./triagem";

/**
 * Quem vista as publicações de cada área na aba Vistagem: um vistador para as demandas normais e outro para as
 * demandas de risco. A lista vem da Controladoria (por enquanto, só o Trabalhista). Área ou tipo de demanda fora
 * daqui aparece como "Vistador a definir" na Visão geral: o nome nunca é deduzido do advogado da pasta.
 */

export const TIPOS_DE_DEMANDA = ["normal", "risco"] as const;
export type TipoDeDemanda = (typeof TIPOS_DE_DEMANDA)[number];

export const ROTULO_DEMANDA: Record<TipoDeDemanda, string> = {
  normal: "Demandas normais",
  risco: "Demandas de risco",
};

export type VistadoresDaArea = Partial<Record<TipoDeDemanda, string>>;
export type MapaDeVistadores = Partial<Record<(typeof ESCRITORIOS)[number], VistadoresDaArea>>;

export const VISTADORES_POR_AREA: MapaDeVistadores = {
  Trabalhista: { normal: "Isadora Godoy", risco: "Caroline Abdalla" },
};

/**
 * Nome completo no RH de quem aparece aqui pelo nome do dia a dia (a foto é procurada pelo nome do RH). Quem já
 * está com o nome do RH no mapa não precisa estar aqui.
 */
const NOME_NO_RH: Record<string, string> = {
  "Isadora Godoy": "Isadora Godoy Conte",
  "Caroline Abdalla": "Caroline Simel Abdalla",
};

export function nomeNoRh(nome: string): string {
  return NOME_NO_RH[nome.trim()] ?? nome.trim();
}

/** A área tem algum vistador cadastrado? */
export function temVistador(area: string, mapa: MapaDeVistadores = VISTADORES_POR_AREA): boolean {
  return TIPOS_DE_DEMANDA.some((tipo) => vistadorDa(area, tipo, mapa));
}

/** Vistador da área para o tipo de demanda; null quando ainda não foi passado. */
export function vistadorDa(area: string, tipo: TipoDeDemanda, mapa: MapaDeVistadores = VISTADORES_POR_AREA): string | null {
  return (mapa as Record<string, VistadoresDaArea | undefined>)[area]?.[tipo]?.trim() || null;
}

/** Áreas com vistador cadastrado, na ordem do mapa. */
export function areasComVistador(mapa: MapaDeVistadores = VISTADORES_POR_AREA): string[] {
  return Object.keys(mapa).filter((area) => temVistador(area, mapa));
}

/** Todos os nomes do mapa, sem repetir (para buscar as fotos). */
export function nomesDosVistadores(mapa: MapaDeVistadores = VISTADORES_POR_AREA): string[] {
  const nomes = areasComVistador(mapa).flatMap((area) => TIPOS_DE_DEMANDA.map((tipo) => vistadorDa(area, tipo, mapa)));
  return [...new Set(nomes.filter((nome): nome is string => Boolean(nome)))];
}
