/**
 * Selo "Atualizado há X h" das telas de Métricas: diz se o dado é confiável.
 * Verde dentro do prazo normal da coleta, amarelo atrasado, vermelho parado
 * ou com falha na última tentativa.
 */
import { formatRelativeTime } from "@/lib/social-metrics/format";

export type FreshnessSource = "instagram" | "linkedin" | "ga4";
export type FreshnessTone = "ok" | "warning" | "danger";

export interface SourceFreshness {
  source: FreshnessSource;
  label: string;
  /** Última coleta/importação que deu certo. */
  lastSuccessAt: string | null;
  /** Última tentativa (pode ter falhado). */
  lastAttemptAt: string | null;
  lastError: string | null;
  /** Último dia com dado gravado (AAAA-MM-DD). */
  dataUntil: string | null;
  /** Depois de quantas horas sem sucesso o dado fica atrasado. */
  staleAfterHours: number;
  /** Como o dado chega ("Coleta automática todo dia às 6h", "Importação manual"...). */
  howItArrives: string;
}

export function freshnessTone(item: SourceFreshness, now: number = Date.now()): FreshnessTone {
  if (!item.lastSuccessAt) return "danger";
  const hours = (now - new Date(item.lastSuccessAt).getTime()) / 3_600_000;
  const failedAfterSuccess =
    Boolean(item.lastError) &&
    Boolean(item.lastAttemptAt) &&
    new Date(item.lastAttemptAt as string).getTime() > new Date(item.lastSuccessAt).getTime();
  if (hours > item.staleAfterHours * 2) return "danger";
  if (hours > item.staleAfterHours || failedAfterSuccess) return "warning";
  return "ok";
}

export function freshnessLabel(item: SourceFreshness, now: number = Date.now()): string {
  if (!item.lastSuccessAt) return "Sem dados";
  return `Atualizado ${formatRelativeTime(item.lastSuccessAt, now)}`;
}
