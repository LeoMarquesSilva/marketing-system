/**
 * Contas do dashboard de boas práticas. Reproduz as fórmulas da planilha
 * (faixa do Reforço do Manual, dias úteis até o retorno, status do fluxo).
 */

import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import {
  FEEDBACK_AREAS,
  FEEDBACK_CATEGORIES,
  categoryInfo,
  type AreaBand,
  type FeedbackFlowStatus,
  type GoodPracticeFeedback,
} from "./types";

type FeedbackFacts = Pick<GoodPracticeFeedback, "sent_on" | "responded_on" | "viewed">;

/** Respondido = tem data de retorno; senão vale o que veio do Feedz. */
export function flowStatus(item: Pick<GoodPracticeFeedback, "responded_on" | "viewed">): FeedbackFlowStatus {
  if (item.responded_on) return "respondido";
  if (item.viewed === true) return "visualizado";
  if (item.viewed === false) return "nao_visualizado";
  return "sem_dado";
}

function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Dias úteis entre o envio e o retorno (NETWORKDAYS − 1 da planilha): segunda
 * a sexta, sem feriados. Retorno anterior ao envio = data inconsistente → null.
 */
export function businessDaysToResponse(sentOn: string, respondedOn: string | null): number | null {
  if (!respondedOn) return null;
  const start = isoToUtc(sentOn);
  const end = isoToUtc(respondedOn);
  if (end < start) return null;
  let weekdays = 0;
  for (let t = start; t <= end; t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) weekdays += 1;
  }
  return Math.max(0, weekdays - 1);
}

/**
 * Faixa da área no mês (Reforço do Manual de Boas Práticas):
 * Acionamento = total do mês acima de 10 e área com 5+, ou área com 3+ no mês
 * e também no mês anterior (recorrência). Atenção = 3+ no mês. Senão Monitoramento.
 */
export function areaBand(count: number, previousCount: number, monthTotal: number): AreaBand | null {
  if (count === 0) return null;
  if ((monthTotal > 10 && count >= 5) || (count >= 3 && previousCount >= 3)) return "acionamento";
  if (count >= 3) return "atencao";
  return "monitoramento";
}

export function worstBand(bands: (AreaBand | null)[]): AreaBand | null {
  if (bands.includes("acionamento")) return "acionamento";
  if (bands.includes("atencao")) return "atencao";
  if (bands.includes("monitoramento")) return "monitoramento";
  return null;
}

/** Área sugerida pelo departamento do cadastro (o RH pode trocar). */
export function suggestAreaFromDepartment(department: string | null | undefined): string | null {
  const trimmed = department?.trim();
  if (!trimmed) return null;
  if (/distressed/i.test(trimmed)) return "ADD";
  const canonical = resolveCanonicalAreaLabel(trimmed);
  if (!canonical || canonical === "Sócio") return null;
  return canonical;
}

export interface MonthRef {
  year: number;
  /** 1–12 */
  month: number;
}

export function monthKey(ref: MonthRef): string {
  return `${ref.year}-${String(ref.month).padStart(2, "0")}`;
}

export function previousMonth(ref: MonthRef): MonthRef {
  return ref.month === 1 ? { year: ref.year - 1, month: 12 } : { year: ref.year, month: ref.month - 1 };
}

export function daysInMonth(ref: MonthRef): number {
  return new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate();
}

function inMonth(iso: string, ref: MonthRef): boolean {
  return iso.slice(0, 7) === monthKey(ref);
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

function withinTwoBusinessDays(item: FeedbackFacts): boolean {
  const days = businessDaysToResponse(item.sent_on, item.responded_on);
  return days !== null && days <= 2;
}

export interface AreaRow {
  area: string;
  sent: number;
  share: number;
  /** null = mês sem dado de visualização (s/d). */
  viewed: number | null;
  responded: number;
  previous: number;
  band: AreaBand | null;
}

export interface CategoryRow {
  category: string;
  sent: number;
  share: number;
  previous: number;
  /** Subtemas do mês (só nas categorias que têm subtema), do maior para o menor; "Sem subtema" por último. */
  subtopics: { name: string; sent: number }[];
}

export const NO_SUBTOPIC = "Sem subtema";

export interface LeaderRow {
  manager: string;
  sent: number;
  viewed: number;
  notViewed: number;
  noData: number;
  responded: number;
  respondedFast: number;
}

export interface WeekRow {
  label: string;
  sent: number;
}

export interface MonthSummary {
  total: number;
  previousTotal: number;
  areasWithFeedback: number;
  topArea: { area: string; sent: number } | null;
  /** Feedbacks do mês com dado de visualização (base do %). */
  viewedBase: number;
  viewed: number;
  notViewed: number;
  responded: number;
  respondedFast: number;
  band: AreaBand | null;
  acionamentoAreas: number;
  atencaoAreas: number;
  areas: AreaRow[];
  categories: CategoryRow[];
  leaders: LeaderRow[];
  weeks: WeekRow[];
}

export function summarizeMonth(items: GoodPracticeFeedback[], ref: MonthRef): MonthSummary {
  const current = items.filter((item) => inMonth(item.sent_on, ref));
  const previous = items.filter((item) => inMonth(item.sent_on, previousMonth(ref)));
  const total = current.length;

  const viewedBase = current.filter((item) => item.viewed !== null).length;
  const byArea = countBy(current, (item) => item.area);
  const previousByArea = countBy(previous, (item) => item.area);

  const areaNames = [...new Set([...FEEDBACK_AREAS, ...byArea.keys(), ...previousByArea.keys()])];
  const areas: AreaRow[] = areaNames
    .map((area) => {
      const ofArea = current.filter((item) => item.area === area);
      const sent = ofArea.length;
      const prev = previousByArea.get(area) ?? 0;
      return {
        area,
        sent,
        share: total ? sent / total : 0,
        viewed: viewedBase ? ofArea.filter((item) => item.viewed === true).length : null,
        responded: ofArea.filter((item) => item.responded_on).length,
        previous: prev,
        band: areaBand(sent, prev, total),
      };
    })
    .sort((a, b) => b.sent - a.sent || b.previous - a.previous || a.area.localeCompare(b.area, "pt-BR"));

  const byCategory = countBy(current, (item) => item.category);
  const previousByCategory = countBy(previous, (item) => item.category);
  const categoryNames = [...new Set([...FEEDBACK_CATEGORIES, ...byCategory.keys(), ...previousByCategory.keys()])];
  const categories: CategoryRow[] = categoryNames
    .map((category) => {
      const sent = byCategory.get(category) ?? 0;
      const ofCategory = current.filter((item) => item.category === category);
      const bySubtopic = categoryInfo(category)?.subtopics ? countBy(ofCategory, (item) => item.subtopic ?? NO_SUBTOPIC) : new Map<string, number>();
      const subtopics = [...bySubtopic.entries()]
        .map(([name, count]) => ({ name, sent: count }))
        .sort((a, b) => Number(a.name === NO_SUBTOPIC) - Number(b.name === NO_SUBTOPIC) || b.sent - a.sent);
      return { category, sent, share: total ? sent / total : 0, previous: previousByCategory.get(category) ?? 0, subtopics };
    })
    .filter((row) => row.sent > 0 || row.previous > 0)
    .sort((a, b) => b.sent - a.sent || b.previous - a.previous || a.category.localeCompare(b.category, "pt-BR"));

  const leaderNames = [...new Set(current.map((item) => item.manager_name))];
  const leaders: LeaderRow[] = leaderNames
    .map((manager) => {
      const ofLeader = current.filter((item) => item.manager_name === manager);
      return {
        manager,
        sent: ofLeader.length,
        viewed: ofLeader.filter((item) => item.viewed === true).length,
        notViewed: ofLeader.filter((item) => item.viewed === false).length,
        noData: ofLeader.filter((item) => item.viewed === null).length,
        responded: ofLeader.filter((item) => item.responded_on).length,
        respondedFast: ofLeader.filter(withinTwoBusinessDays).length,
      };
    })
    .sort((a, b) => b.sent - a.sent || a.manager.localeCompare(b.manager, "pt-BR"));

  const lastDay = daysInMonth(ref);
  const weeks: WeekRow[] = [0, 1, 2, 3, 4]
    .map((index) => {
      const from = index * 7 + 1;
      const to = Math.min(from + 6, lastDay);
      return { from, to, index };
    })
    .filter((week) => week.from <= lastDay)
    .map(({ from, to, index }) => ({
      label: `S${index + 1} · ${String(from).padStart(2, "0")}–${String(to).padStart(2, "0")}`,
      sent: current.filter((item) => {
        const day = Number(item.sent_on.slice(8, 10));
        return day >= from && day <= to;
      }).length,
    }));

  const bands = areas.map((row) => row.band);
  const top = areas[0];
  return {
    total,
    previousTotal: previous.length,
    areasWithFeedback: areas.filter((row) => row.sent > 0).length,
    topArea: top && top.sent > 0 ? { area: top.area, sent: top.sent } : null,
    viewedBase,
    viewed: current.filter((item) => item.viewed === true).length,
    notViewed: current.filter((item) => item.viewed === false).length,
    responded: current.filter((item) => item.responded_on).length,
    respondedFast: current.filter(withinTwoBusinessDays).length,
    band: worstBand(bands),
    acionamentoAreas: bands.filter((band) => band === "acionamento").length,
    atencaoAreas: bands.filter((band) => band === "atencao").length,
    areas,
    categories,
    leaders,
    weeks,
  };
}

export interface YearRow {
  area: string;
  months: number[];
  total: number;
}

export interface YearSummary {
  rows: YearRow[];
  sentByMonth: number[];
  respondedByMonth: number[];
  total: number;
  responded: number;
}

/** Evolução no ano: quando os feedbacks foram enviados (área × mês). */
export function summarizeYear(items: GoodPracticeFeedback[], year: number): YearSummary {
  const ofYear = items.filter((item) => item.sent_on.startsWith(`${year}-`));
  const monthIndex = (item: GoodPracticeFeedback) => Number(item.sent_on.slice(5, 7)) - 1;
  const areaNames = [...new Set([...FEEDBACK_AREAS, ...ofYear.map((item) => item.area)])];
  const rows = areaNames
    .map((area) => {
      const months = Array<number>(12).fill(0);
      for (const item of ofYear) if (item.area === area) months[monthIndex(item)] += 1;
      return { area, months, total: months.reduce((sum, value) => sum + value, 0) };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.area.localeCompare(b.area, "pt-BR"));

  const sentByMonth = Array<number>(12).fill(0);
  const respondedByMonth = Array<number>(12).fill(0);
  for (const item of ofYear) {
    sentByMonth[monthIndex(item)] += 1;
    if (item.responded_on) respondedByMonth[monthIndex(item)] += 1;
  }
  return {
    rows,
    sentByMonth,
    respondedByMonth,
    total: ofYear.length,
    responded: ofYear.filter((item) => item.responded_on).length,
  };
}

export interface RepeatRow {
  name: string;
  area: string;
  count: number;
  lastSentOn: string;
  topCategory: string;
}

/** Quem recebeu 2+ feedbacks no ano (equipes inteiras ficam de fora). */
export function repeatOffenders(items: GoodPracticeFeedback[], year: number): RepeatRow[] {
  const ofYear = items.filter((item) => item.sent_on.startsWith(`${year}-`) && !item.is_team);
  const groups = new Map<string, GoodPracticeFeedback[]>();
  for (const item of ofYear) {
    const key = item.employee_id ?? item.employee_name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()]
    .filter((group) => group.length >= 2)
    .map((group) => {
      const sorted = [...group].sort((a, b) => b.sent_on.localeCompare(a.sent_on));
      const categories = countBy(group, (item) => item.category);
      const topCategory = [...categories.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return {
        name: sorted[0].employee_name,
        area: sorted[0].area,
        count: group.length,
        lastSentOn: sorted[0].sent_on,
        topCategory,
      };
    })
    .sort((a, b) => b.count - a.count || b.lastSentOn.localeCompare(a.lastSentOn));
}

/** Mês corrente no fuso do escritório. */
export function currentMonthRef(now = new Date()): MonthRef {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month };
}

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}
