import { BRAZIL_UF_OPTIONS } from "@/lib/rh/qualifications/types";

/**
 * Campos guardados como "texto/UF" (órgão emissor "SSP/SP", naturalidade
 * "Campinas/SP"), mas preenchidos em duas partes: texto livre + seletor de UF.
 */

const UFS = new Set<string>(BRAZIL_UF_OPTIONS);

export function isBrazilUf(value: string): boolean {
  return UFS.has(value.toUpperCase());
}

export interface UfParts {
  head: string;
  uf: string;
}

/**
 * Separa "texto/UF". Por padrão só a barra separa (é o que o campo grava, e
 * assim "Porto Al…" não vira "Porto" + AL enquanto a pessoa digita).
 * `lenient` entende o que já veio digitado de outro jeito em fichas antigas e
 * na qualificação ("SSP-SP", "Campinas - SP", "Campinas, SP"); com `acronym`,
 * também a sigla colada ("SSPSP").
 */
export function splitUf(
  value: string | null | undefined,
  { lenient = false, acronym = false }: { lenient?: boolean; acronym?: boolean } = {}
): UfParts {
  const text = value ?? "";
  const slash = text.lastIndexOf("/");
  if (slash >= 0) {
    const uf = text.slice(slash + 1).trim().toUpperCase();
    if (!uf || isBrazilUf(uf)) return { head: text.slice(0, slash), uf };
  }
  if (lenient) {
    const separated = text.trim().match(/^(.+?)\s*(?:[,/-]\s*|\s+)([A-Za-z]{2})$/);
    if (separated && isBrazilUf(separated[2])) {
      return { head: separated[1], uf: separated[2].toUpperCase() };
    }
    if (acronym) {
      const glued = text.trim().toUpperCase().match(/^([A-Z]{2,})([A-Z]{2})$/);
      if (glued && isBrazilUf(glued[2])) return { head: glued[1], uf: glued[2] };
    }
  }
  return { head: text, uf: "" };
}

/** Junta as duas partes no formato guardado. Sem UF, fica só o texto. */
export function joinUf(head: string, uf: string): string {
  return uf ? `${head}/${uf}` : head;
}

/** Órgão emissor do RG: siglas em maiúsculas, sem acento nem número. */
export function maskIssuerAcronym(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 15);
}
