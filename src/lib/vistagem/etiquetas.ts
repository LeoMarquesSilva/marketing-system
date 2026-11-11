/**
 * Etiquetas da pasta no VIOS (processos_completo.etiquetas do SIOE), gravadas na publicação na triagem. Chegam num
 * texto só, separadas por "|": "Carteira GPR | Crédito Ativo | RC-Insolvência".
 */

/**
 * Etiquetas que ganham selo próprio na Vistagem, para quem vista ver de cara de que tipo é a pasta. A RC-Insolvência
 * marca as pastas da Recuperação de Crédito ligadas a uma insolvência (recuperação judicial, falência).
 */
export const ETIQUETAS_EM_DESTAQUE = ["RC-Insolvência"];

/** Sem acento, maiúscula, espaço nem hífen: "RC - Insolvencia" e "rc-insolvência" são a mesma etiqueta. */
function chave(etiqueta: string): string {
  return etiqueta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "");
}

/** O texto da pasta em lista, sem vazias nem repetidas (a primeira grafia fica). */
export function listaDeEtiquetas(texto: string | null | undefined): string[] {
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const parte of String(texto ?? "").split("|")) {
    const etiqueta = parte.replace(/\s+/g, " ").trim();
    if (!etiqueta || vistas.has(chave(etiqueta))) continue;
    vistas.add(chave(etiqueta));
    lista.push(etiqueta);
  }
  return lista;
}

/** As etiquetas da pasta que têm selo, com o nome do jeito que está em ETIQUETAS_EM_DESTAQUE. */
export function etiquetasEmDestaque(etiquetas: readonly string[], destaque: readonly string[] = ETIQUETAS_EM_DESTAQUE): string[] {
  const daPasta = new Set(etiquetas.map(chave));
  return destaque.filter((etiqueta) => daPasta.has(chave(etiqueta)));
}

/** A pasta tem a etiqueta? Sem diferença de acento, maiúscula, espaço e hífen. */
export function temEtiqueta(etiquetas: readonly string[], etiqueta: string): boolean {
  const alvo = chave(etiqueta);
  return etiquetas.some((item) => chave(item) === alvo);
}
