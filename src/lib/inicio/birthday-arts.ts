/**
 * Artes de aniversário da tela inicial: o Marketing sobe uma arte por pessoa,
 * tipo (aniversário da pessoa ou de empresa) e ano. O arquivo fica em bucket
 * privado e chega à tela por link assinado.
 */

export type BirthdayArtKind = "aniversario" | "empresa";

export const BIRTHDAY_ART_KINDS: BirthdayArtKind[] = ["aniversario", "empresa"];
export const BIRTHDAY_ART_KIND_LABEL: Record<BirthdayArtKind, string> = {
  aniversario: "Aniversário",
  empresa: "Aniversário de empresa",
};

/** Bucket PRIVADO das artes. */
export const BIRTHDAY_ARTS_BUCKET = "RH-ANIVERSARIOS";
export const BIRTHDAY_ART_MAX_BYTES = 10 * 1024 * 1024;
export const BIRTHDAY_ART_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type BirthdayArtType = (typeof BIRTHDAY_ART_TYPES)[number];

/** Quem sobe e troca as artes: admin e o time de Marketing. O servidor confere de novo. */
export function canManageBirthdayArts(
  profile: { role?: string | null; department?: string | null } | null | undefined
): boolean {
  if (!profile) return false;
  const role = (profile.role ?? "").toLowerCase();
  if (role === "admin" || role === "designer") return true;
  return (profile.department ?? "").trim().toLowerCase() === "marketing";
}

/** Uma pessoa na lista do mês (tela de gerenciar artes). */
export interface BirthdayArtRow {
  employeeId: string;
  name: string;
  department: string | null;
  avatarUrl: string | null;
  kind: BirthdayArtKind;
  /** Dia do mês. */
  day: number;
  /** Ano da comemoração (a arte vale para este ano). */
  year: number;
  /** Anos de casa que a pessoa completa (só no aniversário de empresa). */
  years: number | null;
  /** Link assinado da arte já enviada. */
  artUrl: string | null;
}

export interface BirthdayArtsMonth {
  /** "YYYY-MM". */
  month: string;
  rows: BirthdayArtRow[];
}

/** "YYYY-MM" válido, senão null. */
export function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 && year >= 2020 && year <= 2100 ? { year, month } : null;
}

export function shiftMonth(value: string, delta: number): string {
  const parsed = parseMonth(value);
  if (!parsed) return value;
  const index = parsed.year * 12 + (parsed.month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "novembro de 2026". */
export function monthLabel(value: string): string {
  const parsed = parseMonth(value);
  return parsed ? `${MONTH_NAMES[parsed.month - 1]} de ${parsed.year}` : value;
}
