/** Opção dos campos de escolha com busca da ficha (cidade, banco, nacionalidade). */
export interface ComboOption {
  /** O que é guardado. */
  value: string;
  /** O que aparece na lista (padrão: o próprio valor). */
  label?: string;
  /** Texto miúdo à direita (ex.: código do banco). */
  hint?: string;
  /** Termos extras para a busca (ex.: "341 341"). */
  keywords?: string;
}

/** Chave de comparação: sem acento, minúscula, sem espaços repetidos. */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca sem acento: primeiro quem começa com o termo, depois quem tem uma
 * palavra começando com ele, depois quem só contém. No máximo `limit`.
 */
export function filterOptions(query: string, options: readonly ComboOption[], limit = 60): ComboOption[] {
  const key = searchKey(query);
  if (!key) return options.slice(0, limit);
  const ranked: ComboOption[][] = [[], [], []];
  for (const option of options) {
    const label = searchKey(option.label ?? option.value);
    const haystack = `${label} ${searchKey(option.keywords ?? "")}`;
    if (label.startsWith(key)) ranked[0].push(option);
    else if (haystack.split(/[\s()-]+/).some((word) => word.startsWith(key))) ranked[1].push(option);
    else if (haystack.includes(key)) ranked[2].push(option);
  }
  return ranked.flat().slice(0, limit);
}
