/** Cronograma do dia, cardápio e degustações do evento: tipos e regras puras (sem banco). */

export type ScheduleKind = "dj" | "fala" | "premiacao" | "show" | "outro";

export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  dj: "DJ",
  fala: "Vídeo e falas",
  premiacao: "Premiações",
  show: "Show",
  outro: "Outro",
};

export interface EventSchedule {
  id: string;
  eventId: string;
  name: string;
  summary: string | null;
  isOfficial: boolean;
  sortOrder: number;
}

export interface EventScheduleItem {
  id: string;
  scheduleId: string;
  eventId: string;
  /** "HH:MM". A festa pode atravessar a meia-noite. */
  startTime: string;
  endTime: string;
  title: string;
  kind: ScheduleKind;
  note: string | null;
  /** Retirado do roteiro: fica riscado, para registrar o que saiu. */
  removed: boolean;
  sortOrder: number;
}

const TIME = /^([0-2]\d):([0-5]\d)$/;

export function isScheduleTime(value: string): boolean {
  const match = TIME.exec(value);
  return Boolean(match) && Number(match?.[1]) < 24;
}

function clock(value: string): number {
  const match = TIME.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

/** Minutos desde o começo do roteiro; horário menor que o do começo é do dia seguinte. */
export function minutesFrom(dayStart: string, time: string): number {
  const base = clock(dayStart);
  const value = clock(time);
  return value >= base ? value - base : value + 24 * 60 - base;
}

export function itemMinutes(item: Pick<EventScheduleItem, "startTime" | "endTime">): number {
  return minutesFrom(item.startTime, item.endTime);
}

/** "45 min", "1h", "1h25". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/** "19:30" vira "19h30"; hora cheia vira "19h". */
export function formatClock(time: string): string {
  const match = TIME.exec(time);
  if (!match) return time;
  return match[2] === "00" ? `${match[1]}h` : `${match[1]}h${match[2]}`;
}

/** Começo do roteiro: o menor horário entre os que começam do meio-dia em diante (senão, o menor). */
export function scheduleDayStart(items: EventScheduleItem[]): string {
  const starts = items.map((item) => item.startTime);
  const afternoon = starts.filter((time) => clock(time) >= 12 * 60);
  const pool = afternoon.length > 0 ? afternoon : starts;
  return pool.reduce((first, time) => (clock(time) < clock(first) ? time : first), pool[0] ?? "00:00");
}

export function sortScheduleItems(items: EventScheduleItem[]): EventScheduleItem[] {
  const dayStart = scheduleDayStart(items);
  return [...items].sort(
    (a, b) => minutesFrom(dayStart, a.startTime) - minutesFrom(dayStart, b.startTime) || a.sortOrder - b.sortOrder
  );
}

export type ScheduleRow =
  | { type: "item"; item: EventScheduleItem; minutes: number }
  | { type: "gap"; startTime: string; endTime: string; minutes: number };

/** Linhas do roteiro em ordem, com os intervalos sem nada marcado entre os blocos que valem. */
export function scheduleRows(items: EventScheduleItem[]): ScheduleRow[] {
  const sorted = sortScheduleItems(items);
  const dayStart = scheduleDayStart(items);
  const rows: ScheduleRow[] = [];
  let lastEnd: string | null = null;
  for (const item of sorted) {
    if (!item.removed) {
      if (lastEnd != null) {
        const gap = minutesFrom(dayStart, item.startTime) - minutesFrom(dayStart, lastEnd);
        if (gap > 0) rows.push({ type: "gap", startTime: lastEnd, endTime: item.startTime, minutes: gap });
      }
      if (lastEnd == null || minutesFrom(dayStart, item.endTime) > minutesFrom(dayStart, lastEnd)) lastEnd = item.endTime;
    }
    rows.push({ type: "item", item, minutes: itemMinutes(item) });
  }
  return rows;
}

export interface ScheduleTotals {
  startTime: string | null;
  endTime: string | null;
  byKind: Record<ScheduleKind, number>;
  showBlocks: number;
}

/** Só os blocos que valem (os retirados ficam de fora). */
export function scheduleTotals(items: EventScheduleItem[]): ScheduleTotals {
  const active = sortScheduleItems(items).filter((item) => !item.removed);
  const byKind: Record<ScheduleKind, number> = { dj: 0, fala: 0, premiacao: 0, show: 0, outro: 0 };
  for (const item of active) byKind[item.kind] += itemMinutes(item);
  const dayStart = scheduleDayStart(items);
  const last = active.reduce<EventScheduleItem | null>(
    (latest, item) => (!latest || minutesFrom(dayStart, item.endTime) > minutesFrom(dayStart, latest.endTime) ? item : latest),
    null
  );
  return {
    startTime: active[0]?.startTime ?? null,
    endTime: last?.endTime ?? null,
    byKind,
    showBlocks: active.filter((item) => item.kind === "show").length,
  };
}

/* ───────────────────────────── Cardápio ───────────────────────────── */

export type MenuType = "comida" | "bebida";
export type MenuStatus = "aprovado" | "em_analise";

export interface EventMenuItem {
  id: string;
  eventId: string;
  menuType: MenuType;
  section: string;
  name: string;
  note: string | null;
  /** Destaque da seção (ex.: prato principal). */
  highlight: boolean;
  status: MenuStatus;
  vendorName: string | null;
  sortOrder: number;
}

export interface MenuSection {
  section: string;
  items: EventMenuItem[];
}

/** Seções na ordem em que aparecem no cardápio. */
export function groupMenu(items: EventMenuItem[], menuType: MenuType): MenuSection[] {
  const sections: MenuSection[] = [];
  const sorted = items.filter((item) => item.menuType === menuType).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of sorted) {
    const key = item.section.trim().toLowerCase();
    const found = sections.find((section) => section.section.trim().toLowerCase() === key);
    if (found) found.items.push(item);
    else sections.push({ section: item.section.trim(), items: [item] });
  }
  return sections;
}

/* ──────────────────────────── Degustações ─────────────────────────── */

export type TastingStatus = "agendada" | "realizada" | "cancelada";
export type ParticipantStatus = "confirmado" | "a_confirmar";

export interface TastingParticipant {
  name: string;
  userId: string | null;
  status: ParticipantStatus;
  note: string | null;
}

export interface EventTasting {
  id: string;
  eventId: string;
  menuType: MenuType;
  vendorName: string;
  /** "AAAA-MM-DD". */
  tastingDate: string | null;
  tastingTime: string | null;
  location: string | null;
  linkUrl: string | null;
  status: TastingStatus;
  resultNote: string | null;
  participants: TastingParticipant[];
  sortOrder: number;
}

export function parseParticipants(value: unknown): TastingParticipant[] {
  if (!Array.isArray(value)) return [];
  const list: TastingParticipant[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) continue;
    list.push({
      name,
      userId: typeof raw.userId === "string" && raw.userId ? raw.userId : null,
      status: raw.status === "a_confirmar" ? "a_confirmar" : "confirmado",
      note: typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null,
    });
  }
  return list;
}

export function participantCounts(participants: TastingParticipant[]): { confirmed: number; pending: number } {
  const pending = participants.filter((person) => person.status === "a_confirmar").length;
  return { confirmed: participants.length - pending, pending };
}

/** Agendadas primeiro (a mais próxima em cima); realizadas depois, da mais recente para a mais antiga. */
export function splitTastings(tastings: EventTasting[], menuType: MenuType): { upcoming: EventTasting[]; done: EventTasting[] } {
  const ofType = tastings.filter((tasting) => tasting.menuType === menuType && tasting.status !== "cancelada");
  const key = (tasting: EventTasting) => `${tasting.tastingDate ?? "9999-12-31"} ${tasting.tastingTime ?? "00:00"}`;
  return {
    upcoming: ofType.filter((tasting) => tasting.status === "agendada").sort((a, b) => key(a).localeCompare(key(b))),
    done: ofType.filter((tasting) => tasting.status === "realizada").sort((a, b) => key(b).localeCompare(key(a))),
  };
}

/** Dias até a data ("AAAA-MM-DD"), a partir de hoje no mesmo formato. Negativo = já passou. */
export function daysUntil(date: string | null, today: string): number | null {
  if (!date) return null;
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/** Só aceita endereço https (Instagram, site do fornecedor). */
export function tastingLinkHref(url: string | null | undefined): string | null {
  const value = (url ?? "").trim();
  return /^https:\/\/\S+$/i.test(value) ? value : null;
}
