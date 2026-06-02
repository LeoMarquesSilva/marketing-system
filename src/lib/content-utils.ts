import { subDays } from "date-fns";

/** Janela máxima de exibição: notícias mais antigas que isso não aparecem. */
export const CONTENT_MAX_AGE_DAYS = 60;

/** Destaques "recentes" na UI (subconjunto dentro dos 60 dias). */
export const CONTENT_HIGHLIGHT_DAYS = 14;

export interface DatedItem {
  published_at: string | null;
  created_at: string;
}

export function getContentCutoffDate(days = CONTENT_MAX_AGE_DAYS): Date {
  return subDays(new Date(), days);
}

export function getRoteiroDate(item: DatedItem): Date {
  return new Date(item.published_at ?? item.created_at);
}

export function isWithinContentWindow(item: DatedItem, days = CONTENT_MAX_AGE_DAYS): boolean {
  return getRoteiroDate(item) >= getContentCutoffDate(days);
}

export function isRecentRoteiro(item: DatedItem, days = CONTENT_HIGHLIGHT_DAYS): boolean {
  return getRoteiroDate(item) >= getContentCutoffDate(days);
}

export function sortByDateDesc<T extends DatedItem>(items: T[]): T[] {
  return [...items].sort((a, b) => getRoteiroDate(b).getTime() - getRoteiroDate(a).getTime());
}
