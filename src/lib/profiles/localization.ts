/**
 * Resolução de idioma do perfil público.
 *
 * Regra de negócio: inglês só vai ao ar depois de aprovado. Um registro em
 * inglês não aprovado cai inteiramente para PT (evita publicar meia tradução);
 * um registro aprovado ainda cai campo a campo quando algum opcional está
 * vazio, para nunca deixar buraco na página.
 */

import type { ProfessionalProfileLocalization, ProfileLocale } from "@/lib/profiles/types";

/** Traduz o idioma pedido para o par suportado; desconhecido vira pt-BR. */
export function resolveProfileLocale(requested?: string | null): ProfileLocale {
  const normalized = (requested ?? "").trim().toLowerCase();
  if (!normalized) return "pt-BR";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return "pt-BR";
}

/**
 * Valor de um campo no idioma pedido, caindo para pt-BR quando o valor
 * pedido está ausente ou em branco. Nunca cai de pt-BR para inglês.
 */
export function localizeField(
  values: Partial<Record<ProfileLocale, string | null>>,
  locale: ProfileLocale
): string {
  const requested = values[locale];
  if (requested && requested.trim()) return requested;
  if (locale === "pt-BR") return requested ?? "";
  const fallback = values["pt-BR"];
  return fallback && fallback.trim() ? fallback : "";
}

/**
 * Escolhe o registro de localização que pode ir ao ar.
 * Inglês não aprovado (ou inexistente) devolve o registro em português.
 */
export function selectApprovedLocalization(
  pt: ProfessionalProfileLocalization,
  en: ProfessionalProfileLocalization | null | undefined,
  locale: ProfileLocale
): ProfessionalProfileLocalization {
  if (locale === "pt-BR") return pt;
  if (!en || !en.isApproved) return pt;
  return en;
}
