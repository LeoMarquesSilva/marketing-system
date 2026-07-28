/**
 * Slug público do perfil profissional.
 *
 * O slug entra na URL permanente do cartão NFC, então precisa ser estável,
 * previsível e sem acento — trocá-lo depois exige registrar um redirect.
 */

/**
 * Converte um nome em slug: sem acento, minúsculo e separado por hífen.
 * Devolve string vazia quando não sobra nenhum caractere utilizável.
 */
export function makeProfileSlug(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    // Remove os diacríticos separados pela normalização (acento, til, cedilha).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Qualquer coisa que não seja letra/número vira separador.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Primeiro slug livre a partir de uma base, usando sufixo numérico
 * determinístico. Nunca devolve um slug já ocupado — o chamador passa o
 * conjunto de slugs em uso (perfis atuais + redirects antigos).
 */
export function nextProfileSlugCandidate(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
