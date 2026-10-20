/**
 * Municípios por UF (IBGE) para os campos de cidade da ficha: a pessoa escolhe
 * na lista em vez de digitar, e o nome fica igual para todo mundo na análise.
 */

import { searchKey as cityKey } from "./combo-search";

export { cityKey };

const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "SÃO JOÃO DA BOA VISTA" → "São João da Boa Vista"; "PALMEIRA D'OESTE" → "Palmeira d'Oeste". */
export function titleCaseCity(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && PARTICLES.has(word)) return word;
      if (/^d'/.test(word)) return `d'${word.charAt(2).toUpperCase()}${word.slice(3)}`;
      return word
        .split("-")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join("-");
    })
    .join(" ");
}

/** Nome oficial da lista que corresponde ao digitado (ignorando acento e caixa). */
export function matchCity(value: string, cities: readonly string[]): string | null {
  const key = cityKey(value);
  if (!key) return null;
  return cities.find((city) => cityKey(city) === key) ?? null;
}

const cache = new Map<string, Promise<string[]>>();

/** Lista da UF pela rota /api/municipios (uma busca por UF por sessão do navegador). */
export function loadMunicipios(uf: string): Promise<string[]> {
  const key = uf.toUpperCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const request = fetch(`/api/municipios/${key}`)
    .then(async (response) => {
      if (!response.ok) throw new Error("municipios");
      const data = (await response.json()) as { cities?: string[] };
      return data.cities ?? [];
    })
    .catch((error: unknown) => {
      cache.delete(key); // tenta de novo na próxima vez
      throw error;
    });
  cache.set(key, request);
  return request;
}
