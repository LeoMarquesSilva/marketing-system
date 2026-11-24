import type { FeedbackKind, FeedbackSummary, FeedbackValue, FeedbackVisibility } from "./types";
import { FEEDBACK_VALUES } from "./types";

/** Quem vê o quê. Regras das decisões de 23/11/2026 (docs/feedz/proposta-feedback.md). */
export interface ViewerInfo {
  employeeId: string | null;
  /** Pessoas que o visitante lidera (gestor direto/indireto ou liderança por área). */
  team: Set<string>;
  isHr: boolean;
  /** Configuração: o RH lê o texto de todos (decisão 1b). */
  hrReadsContent: boolean;
}

export interface FeedbackAccessRow {
  from_employee_id: string;
  to_employee_id: string;
  visibility: FeedbackVisibility;
  kind: FeedbackKind;
  deleted_at: string | null;
}

export type ViewerRole = FeedbackSummary["viewer"];

/** Como o visitante enxerga o feedback; null = não vê. */
export function viewerRole(row: FeedbackAccessRow, viewer: ViewerInfo): ViewerRole | null {
  if (row.deleted_at) return viewer.isHr ? "rh" : null;
  if (viewer.employeeId && row.from_employee_id === viewer.employeeId) return "remetente";
  if (viewer.employeeId && row.to_employee_id === viewer.employeeId) return "destinatario";
  if (row.visibility === "gestor" && viewer.team.has(row.to_employee_id)) return "gestor";
  if (row.visibility === "publico" && row.kind === "reconhecimento") return "mural";
  if (viewer.isHr && viewer.hrReadsContent) return "rh";
  return null;
}

/** O autor apaga em até 24 h; depois só o RH (fica guardado como apagado). */
export const DELETE_WINDOW_HOURS = 24;

export function deleteDeadline(createdAt: string): string {
  return new Date(new Date(createdAt).getTime() + DELETE_WINDOW_HOURS * 3_600_000).toISOString();
}

export function canDelete(row: FeedbackAccessRow & { created_at: string }, viewer: ViewerInfo, now = new Date()): boolean {
  if (row.deleted_at) return false;
  if (viewer.isHr) return true;
  return Boolean(viewer.employeeId) && row.from_employee_id === viewer.employeeId && now.getTime() <= new Date(deleteDeadline(row.created_at)).getTime();
}

/** Mural só aceita reconhecimento; desenvolvimento é sempre privado ou com o gestor. */
export function normalizeVisibility(kind: "reconhecimento" | "desenvolvimento", visibility: FeedbackVisibility, muralEnabled: boolean): FeedbackVisibility {
  if (visibility === "publico" && (kind !== "reconhecimento" || !muralEnabled)) return "gestor";
  return visibility;
}

export function sanitizeValues(values: readonly string[]): FeedbackValue[] {
  const unique = [...new Set(values)].filter((value): value is FeedbackValue => (FEEDBACK_VALUES as readonly string[]).includes(value));
  return unique.slice(0, 2);
}

/** Dias inteiros entre a data e hoje (fuso de Brasília não importa para a régua de 30/60/90). */
export function daysAgo(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

export type CoverageBand = "ok" | "30" | "60" | "90" | "nunca";

/** Faixa do painel de cobertura: em dia, mais de 30, 60 ou 90 dias, ou nunca. */
export function coverageBand(days: number | null, limit = 30): CoverageBand {
  if (days === null) return "nunca";
  if (days <= limit) return "ok";
  if (days <= 60) return "30";
  if (days <= 90) return "60";
  return "90";
}

/** Texto curto da lista (sem quebrar palavra no meio). */
export function excerpt(text: string, max = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

/**
 * Até 22/11/2026 as ocorrências de Boas práticas saíam pelo Feedz e só eram
 * registradas aqui. Registro dessa época sem ligação com feedback do ORQESTRAI
 * já foi enviado: não oferecemos "Enviar ao gestor" para não duplicar.
 */
export const GOOD_PRACTICE_ORQESTRAI_SINCE = "2026-11-23";

export function goodPracticeSentByFeedz(sentOn: string | null | undefined): boolean {
  return Boolean(sentOn) && String(sentOn).slice(0, 10) < GOOD_PRACTICE_ORQESTRAI_SINCE;
}

/** Tira do começo da ocorrência o título fixo e a saudação, para o resumo da lista mostrar o fato. */
export function skipGoodPracticeIntro(text: string): string {
  const clean = text
    .replace(/^\s*Registro de Ocorr[êe]ncia\s*\|\s*Boas Pr[áa]ticas no Escrit[óo]rio\s*/i, "")
    .replace(/^\s*Prezad[oa]s?\s+[^,\n]{1,60},\s*(bom dia|boa tarde|boa noite)\s*[.!]?\s*/i, "");
  return clean.trim() || text;
}
