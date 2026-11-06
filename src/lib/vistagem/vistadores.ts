import type { ESCRITORIOS } from "./triagem";

/**
 * Quem vista as publicações de cada área na aba Vistagem: as pessoas das demandas normais e as das demandas de
 * risco (podem ser várias). A base é a lista USUARIOS do SharePoint (importada em Configurações), com ajustes do
 * admin. "Todas as áreas" é quem vista qualquer área (sócios, controladoria). Área ou tipo sem ninguém aparece como
 * "Vistador a definir" na Visão geral: o nome nunca é deduzido do advogado da pasta.
 */

export const TIPOS_DE_DEMANDA = ["normal", "risco"] as const;
export type TipoDeDemanda = (typeof TIPOS_DE_DEMANDA)[number];

export const ROTULO_DEMANDA: Record<TipoDeDemanda, string> = {
  normal: "Demandas normais",
  risco: "Demandas de risco",
};

/** Quem vista qualquer área (na lista USUARIOS, área "TODAS"). */
export const TODAS_AS_AREAS_VISTAGEM = "Todas as áreas";

export type AreaDeVistador = (typeof ESCRITORIOS)[number] | typeof TODAS_AS_AREAS_VISTAGEM;
export type VistadoresDaArea = Partial<Record<TipoDeDemanda, string[]>>;
export type MapaDeVistadores = Partial<Record<AreaDeVistador, VistadoresDaArea>>;

export const VISTADORES_POR_AREA: MapaDeVistadores = {
  Trabalhista: { normal: ["Isadora Godoy"], risco: ["Caroline Abdalla"] },
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

/** Lista limpa de nomes: aceita o formato antigo (um nome só, em texto) e tira vazios e repetidos. */
export function listaDeNomes(valor: unknown): string[] {
  const brutos = Array.isArray(valor) ? valor : typeof valor === "string" ? [valor] : [];
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const bruto of brutos) {
    const nome = typeof bruto === "string" ? bruto.trim() : "";
    const chave = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!nome || vistos.has(chave)) continue;
    vistos.add(chave);
    nomes.push(nome);
  }
  return nomes;
}

const daArea = (mapa: MapaDeVistadores, area: string) => (mapa as Record<string, Record<string, unknown> | undefined>)[area];

/** Quem vista a área no tipo de demanda (vazio quando ainda não foi passado). */
export function vistadoresDa(area: string, tipo: TipoDeDemanda, mapa: MapaDeVistadores = VISTADORES_POR_AREA): string[] {
  return listaDeNomes(daArea(mapa, area)?.[tipo]);
}

/** O primeiro vistador da área no tipo; null quando ainda não foi passado. */
export function vistadorDa(area: string, tipo: TipoDeDemanda, mapa: MapaDeVistadores = VISTADORES_POR_AREA): string | null {
  return vistadoresDa(area, tipo, mapa)[0] ?? null;
}

/** A área tem alguém cadastrado? */
export function temVistador(area: string, mapa: MapaDeVistadores = VISTADORES_POR_AREA): boolean {
  return TIPOS_DE_DEMANDA.some((tipo) => vistadoresDa(area, tipo, mapa).length > 0);
}

/** Áreas com vistador cadastrado, na ordem do mapa (sem "Todas as áreas", que não é uma fila). */
export function areasComVistador(mapa: MapaDeVistadores = VISTADORES_POR_AREA): string[] {
  return Object.keys(mapa).filter((area) => area !== TODAS_AS_AREAS_VISTAGEM && temVistador(area, mapa));
}

/** Todos os nomes do mapa (inclusive "Todas as áreas"), sem repetir (para buscar as fotos). */
export function nomesDosVistadores(mapa: MapaDeVistadores = VISTADORES_POR_AREA): string[] {
  const nomes = Object.keys(mapa).flatMap((area) => TIPOS_DE_DEMANDA.flatMap((tipo) => vistadoresDa(area, tipo, mapa)));
  return listaDeNomes(nomes);
}
