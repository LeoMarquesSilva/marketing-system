import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { MarketingRequest } from "@/lib/marketing-requests";
import type { PlannerReel } from "@/lib/reel-deliveries/types";
import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import {
  getContentBankDisplayTitle,
  isInContentBank,
  isPostedOnCalendar,
  isReelRequest,
} from "@/lib/planner-posts";

/**
 * Item do calendário de posts do Planner: uma solicitação (post ou reel antigo)
 * ou um reel da Aprovação de Reels.
 */
export type CalendarItem =
  | { kind: "request"; id: string; request: MarketingRequest }
  | { kind: "reel"; id: string; reel: PlannerReel };

export interface CalendarPerson {
  name: string;
  avatarUrl: string | null;
}

export function calendarItemFromRequest(request: MarketingRequest): CalendarItem {
  return { kind: "request", id: request.id, request };
}

export function calendarItemFromReel(reel: PlannerReel): CalendarItem {
  return { kind: "reel", id: reel.id, reel };
}

export function isReelItem(item: CalendarItem): boolean {
  return item.kind === "reel" || isReelRequest(item.request);
}

export function calendarItemTitle(item: CalendarItem): string {
  if (item.kind === "request") return getContentBankDisplayTitle(item.request);
  if (item.reel.coverTitle?.trim()) return item.reel.coverTitle;
  const names = item.reel.participants.map((p) => p.name.split(" ")[0]);
  return names.length ? `Reel de ${names.join(" e ")}` : "Reel sem título";
}

export function calendarItemArea(item: CalendarItem): string {
  return item.kind === "request" ? item.request.requesting_area : item.reel.area;
}

export function calendarItemPeople(item: CalendarItem): CalendarPerson[] {
  if (item.kind === "reel") {
    return item.reel.participants.map((p) => ({ name: p.name, avatarUrl: p.avatarUrl }));
  }
  const r = item.request;
  const name = r.nome_advogado || r.solicitante_user?.name || r.solicitante;
  if (!name) return [];
  return [{ name, avatarUrl: r.solicitante_user?.avatar_url ?? null }];
}

export function isCalendarItemInBank(item: CalendarItem): boolean {
  return item.kind === "request" ? isInContentBank(item.request) : item.reel.status === "ready";
}

export function isCalendarItemPosted(item: CalendarItem): boolean {
  return item.kind === "request"
    ? isPostedOnCalendar(item.request)
    : item.reel.status === "published" && Boolean(item.reel.publishedAt);
}

/** Momento da publicação no calendário (ISO), quando o item já foi postado. */
export function calendarItemPostedAt(item: CalendarItem): string | null {
  if (!isCalendarItemPosted(item)) return null;
  return item.kind === "request" ? item.request.posted_at : item.reel.publishedAt;
}

/** Dia (`yyyy-MM-dd`, fuso do navegador) em que o item aparece no calendário. */
export function calendarItemDayKey(item: CalendarItem): string | null {
  const postedAt = calendarItemPostedAt(item);
  return postedAt ? format(new Date(postedAt), "yyyy-MM-dd") : null;
}

/** Desde quando o item está disponível no banco. */
export function calendarItemBankSince(item: CalendarItem): string {
  if (item.kind === "reel") {
    return item.reel.readyAt ?? item.reel.publishedAt ?? item.reel.dueDate ?? new Date(0).toISOString();
  }
  const r = item.request;
  return r.stage_changed_at ?? r.delivered_at ?? r.requested_at;
}

/** Data usada pelos filtros "De/Até" da aba Posts. */
export function calendarItemFilterDate(item: CalendarItem): string {
  if (item.kind === "reel") {
    return item.reel.publishedAt ?? item.reel.readyAt ?? item.reel.dueDate ?? new Date(0).toISOString();
  }
  return item.request.delivered_at || item.request.requested_at;
}

export function calendarItemMatchesSearch(item: CalendarItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack =
    item.kind === "request"
      ? [item.request.title, item.request.description, ...calendarItemPeople(item).map((p) => p.name)]
      : [item.reel.coverTitle, item.reel.coverSubtitle, item.reel.caption, item.reel.area, ...item.reel.participants.map((p) => p.name)];
  return haystack.some((text) => (text ?? "").toLowerCase().includes(q));
}

/** Coloca o item no dia, como o calendário vai mostrar depois de salvo. */
export function withCalendarDay(item: CalendarItem, dayKey: string): CalendarItem {
  const postedAt = `${dayKey}T12:00:00.000Z`;
  if (item.kind === "request") {
    return { ...item, request: { ...item.request, completion_type: "postagem_feita", posted_at: postedAt } };
  }
  return { ...item, reel: { ...item.reel, status: "published", publishedAt: postedAt } };
}

/** Ordem cronológica do calendário; no mesmo dia, pelo horário gravado. */
export function sortByPostedAt(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => {
    const da = calendarItemDayKey(a) ?? "";
    const db = calendarItemDayKey(b) ?? "";
    if (da !== db) return da < db ? -1 : 1;
    const ta = calendarItemPostedAt(a) ?? "";
    const tb = calendarItemPostedAt(b) ?? "";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Rodízio de áreas
// ---------------------------------------------------------------------------

/** Conteúdo institucional não ocupa a vez de nenhuma área. */
const OUTSIDE_ROTATION_KEYS = new Set(["institucional", "geral", "socio", "marketing"]);

function areaKey(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Área do rodízio com o nome oficial ("Contratos" → "Societário e Contratos",
 * "Insolvência" → "Reestruturação"); `null` para o que fica fora do rodízio.
 */
export function rotationAreaOf(area: string | null | undefined, rotationAreas: readonly string[]): string | null {
  const raw = area?.trim();
  if (!raw || OUTSIDE_ROTATION_KEYS.has(areaKey(raw))) return null;
  const label = resolveCanonicalAreaLabel(raw);
  if (!label) return null;
  if (rotationAreas.length > 0 && !rotationAreas.includes(label)) return null;
  return label;
}

export interface AreaRotationEntry {
  area: string;
  /** Último dia com post ou reel da área no calendário (pode ser futuro, se já agendado). */
  lastPostedOn: string | null;
  /** Dias desde esse post; negativo quando ainda está agendado. */
  daysSince: number | null;
  bankPosts: number;
  bankReels: number;
  /** Reels da área ainda em aprovação ou em capa e legenda. */
  inProduction: number;
  /** É a área do post mais recente do calendário: evitar repetir. */
  isLastPosted: boolean;
  recommended: boolean;
}

export interface AreaRotation {
  /** Da área há mais tempo sem postar para a mais recente. */
  entries: AreaRotationEntry[];
  recommendedArea: string | null;
  lastPostedArea: string | null;
}

export interface AreaRotationInput {
  /** Áreas do cronograma editorial; vazio usa as áreas que aparecem nos itens. */
  rotationAreas: readonly string[];
  posted: CalendarItem[];
  bank: CalendarItem[];
  /** Áreas dos reels que ainda não chegaram ao banco, um por reel. */
  inProductionAreas: readonly string[];
  /** Hoje, `yyyy-MM-dd`. */
  today: string;
}

/**
 * Próxima área a postar: a que está há mais tempo sem post e tem algo pronto
 * no banco, pulando a área do último post. Se só ela tiver conteúdo, ela volta
 * a ser a recomendada ("quando possível").
 */
export function buildAreaRotation(input: AreaRotationInput): AreaRotation {
  const known = new Set(input.rotationAreas);
  if (known.size === 0) {
    for (const item of [...input.posted, ...input.bank]) {
      const area = rotationAreaOf(calendarItemArea(item), []);
      if (area) known.add(area);
    }
  }
  const areas = [...known];
  const areaOf = (value: string) => rotationAreaOf(value, areas);

  const posted = sortByPostedAt(input.posted);
  const lastItem = posted[posted.length - 1];
  const lastPostedArea = lastItem ? areaOf(calendarItemArea(lastItem)) : null;

  const lastByArea = new Map<string, string>();
  for (const item of posted) {
    const area = areaOf(calendarItemArea(item));
    const day = calendarItemDayKey(item);
    if (area && day) lastByArea.set(area, day);
  }

  const today = parseISO(input.today);
  const entries: AreaRotationEntry[] = areas.map((area) => {
    const lastPostedOn = lastByArea.get(area) ?? null;
    const bankItems = input.bank.filter((item) => areaOf(calendarItemArea(item)) === area);
    return {
      area,
      lastPostedOn,
      daysSince: lastPostedOn ? differenceInCalendarDays(today, parseISO(lastPostedOn)) : null,
      bankPosts: bankItems.filter((item) => !isReelItem(item)).length,
      bankReels: bankItems.filter(isReelItem).length,
      inProduction: input.inProductionAreas.filter((value) => areaOf(value) === area).length,
      isLastPosted: area === lastPostedArea,
      recommended: false,
    };
  });

  entries.sort((a, b) => {
    if (a.lastPostedOn !== b.lastPostedOn) {
      if (a.lastPostedOn === null) return -1;
      if (b.lastPostedOn === null) return 1;
      return a.lastPostedOn < b.lastPostedOn ? -1 : 1;
    }
    return a.area.localeCompare(b.area, "pt-BR");
  });

  const hasBank = (entry: AreaRotationEntry) => entry.bankPosts + entry.bankReels > 0;
  const recommended = entries.find((entry) => hasBank(entry) && !entry.isLastPosted) ?? entries.find(hasBank) ?? null;
  if (recommended) recommended.recommended = true;

  return { entries, recommendedArea: recommended?.area ?? null, lastPostedArea };
}

/**
 * Banco na ordem do rodízio: primeiro a área recomendada, depois as demais na
 * vez delas; o que está fora do rodízio vai para o fim. Dentro da mesma área,
 * mantém a ordem recebida.
 */
export function sortBankByRotation(bank: CalendarItem[], rotation: AreaRotation, rotationAreas: readonly string[]): CalendarItem[] {
  const areas = rotationAreas.length > 0 ? rotationAreas : rotation.entries.map((e) => e.area);
  const order = new Map<string, number>();
  if (rotation.recommendedArea) order.set(rotation.recommendedArea, -1);
  rotation.entries.forEach((entry, index) => {
    if (!order.has(entry.area)) order.set(entry.area, index);
  });
  const rank = (item: CalendarItem) => {
    const area = rotationAreaOf(calendarItemArea(item), areas);
    return area !== null && order.has(area) ? order.get(area)! : Number.MAX_SAFE_INTEGER;
  };
  return bank
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

/** Ids dos itens do calendário que repetem a área do item imediatamente anterior. */
export function findAreaRepeats(posted: CalendarItem[], rotationAreas: readonly string[]): Set<string> {
  const repeats = new Set<string>();
  let previous: string | null = null;
  for (const item of sortByPostedAt(posted)) {
    const area = rotationAreaOf(calendarItemArea(item), rotationAreas);
    if (area && area === previous) repeats.add(item.id);
    previous = area;
  }
  return repeats;
}
