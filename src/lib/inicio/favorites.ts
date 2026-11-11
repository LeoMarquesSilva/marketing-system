/**
 * Favoritos da tela inicial: atalhos que a pessoa escolhe (módulos e
 * ferramentas da área). Ficam na conta (`users.home_favorites`), então
 * acompanham a pessoa em qualquer computador ou celular.
 */

/** Quantos atalhos cabem na faixa de favoritos. */
export const MAX_FAVORITES = 8;

export const moduleFavoriteKey = (featureId: string) => `m:${featureId}`;
export const linkFavoriteKey = (linkId: string) => `l:${linkId}`;

const KEY_FORMAT = /^[ml]:[A-Za-z0-9_-]{1,80}$/;

/** Lista válida de favoritos (sem repetidos, no limite); null quando a entrada não é uma lista. */
export function sanitizeFavorites(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const keys = value.filter((key): key is string => typeof key === "string" && KEY_FORMAT.test(key));
  return [...new Set(keys)].slice(0, MAX_FAVORITES);
}

/**
 * Favoritos da primeira versão, que ficavam só no navegador (10/11/2026).
 * Lidos uma vez para subir à conta e apagados em seguida.
 */
const LEGACY_PREFIX = "orqestrai:inicio:favoritos:";

export function takeLegacyFavorites(userId: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_PREFIX + userId);
    if (raw === null) return null;
    window.localStorage.removeItem(LEGACY_PREFIX + userId);
    return sanitizeFavorites(JSON.parse(raw));
  } catch {
    return null;
  }
}
