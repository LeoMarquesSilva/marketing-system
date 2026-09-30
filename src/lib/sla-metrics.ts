/**
 * Métricas de tempo por tipo de solicitação, usadas como base para definir SLAs.
 *
 * Três medidas diferentes, porque respondem perguntas diferentes:
 * - Esforço: horas apontadas no timesheet (quanto trabalho a peça consome).
 * - 1ª versão: dias úteis do pedido até a peça sair de produção pela primeira
 *   vez (revisão, aprovada, envio). É o prazo que o solicitante sente.
 * - Conclusão: dias úteis do pedido até "Concluído". Em posts inclui a espera
 *   pela data de publicação, então tende a ser maior que a 1ª versão.
 *
 * O SLA sugerido usa o P80 (80% das peças ficaram dentro dele), que é mais
 * realista que a média e não é distorcido por uma peça atípica.
 *
 * Como os pedidos chegam em lote, o prazo proposto (sla-policy.ts) é medido
 * também nas semanas cheias: as 25% semanas com mais horas de produção pedidas.
 */

import type { MarketingRequest } from "@/lib/marketing-requests";

export interface SlaTimeEntry {
  request_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface SlaStageChange {
  request_id: string;
  to_value: string | null;
  created_at: string;
}

/** Etapas que indicam que a peça saiu de produção (1ª versão entregue). */
const FIRST_VERSION_STAGES = new Set([
  "revisao",
  "revisado",
  "pronto_envio",
  "tarefas_leonardo",
  "concluido",
]);

const SAO_PAULO_TZ = "America/Sao_Paulo";
const MIN_SAMPLE_MEDIUM = 5;
const MIN_SAMPLE_HIGH = 15;

export type SlaConfidence = "baixa" | "media" | "alta";

export interface SlaStat {
  amostra: number;
  mediana: number | null;
  p80: number | null;
  media: number | null;
  maximo: number | null;
}

export interface SlaRequestDetail {
  id: string;
  title: string;
  type: string;
  requestedAt: string;
  firstVersionAt: string | null;
  doneAt: string | null;
  firstVersionBusinessDays: number | null;
  doneBusinessDays: number | null;
  effortHours: number | null;
  adjustmentRounds: number;
  deadline: string | null;
  onTime: boolean | null;
}

export interface SlaTypeRow {
  type: string;
  concluidas: number;
  esforcoHoras: SlaStat;
  primeiraVersaoDias: SlaStat;
  conclusaoDias: SlaStat;
  ajustesMedia: number | null;
  pctComAjuste: number | null;
  comPrazo: number;
  noPrazo: number;
  sugestao: {
    esforcoHoras: number | null;
    primeiraVersaoDias: number | null;
    conclusaoDias: number | null;
  };
  confianca: SlaConfidence;
}

export interface SlaReport {
  rows: SlaTypeRow[];
  details: SlaRequestDetail[];
}

/** Percentil com interpolação linear (p entre 0 e 1). */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

function stat(values: number[]): SlaStat {
  if (values.length === 0) return { amostra: 0, mediana: null, p80: null, media: null, maximo: null };
  return {
    amostra: values.length,
    mediana: percentile(values, 0.5),
    p80: percentile(values, 0.8),
    media: values.reduce((a, b) => a + b, 0) / values.length,
    maximo: Math.max(...values),
  };
}

/**
 * Data civil (YYYY-MM-DD) em São Paulo. Datas importadas da planilha antiga
 * vêm como meia-noite UTC e representam só o dia — mantidas como estão.
 */
function toLocalDate(iso: string): string {
  if (/T00:00:00(\.0+)?(Z|\+00:00)$/.test(iso) || /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso.slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TZ }).format(new Date(iso));
}

/**
 * Dias úteis (seg–sex) entre duas datas, sem contar o dia inicial.
 * Mesmo dia = 0; pedido na sexta e entregue na segunda = 1. Feriados não são descontados.
 */
export function businessDaysBetween(startIso: string, endIso: string): number {
  const start = toLocalDate(startIso);
  const end = toLocalDate(endIso);
  if (end <= start) return 0;
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  let days = 0;
  while (cursor < last) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

function confidenceFor(sample: number): SlaConfidence {
  if (sample >= MIN_SAMPLE_HIGH) return "alta";
  if (sample >= MIN_SAMPLE_MEDIUM) return "media";
  return "baixa";
}

/** Arredonda esforço para cima em blocos de 15 min. */
function roundUpQuarterHour(hours: number | null): number | null {
  if (hours == null) return null;
  return Math.max(0.25, Math.ceil(hours * 4) / 4);
}

function roundUpDays(days: number | null): number | null {
  if (days == null) return null;
  return Math.ceil(days);
}

function isConcluded(request: MarketingRequest): boolean {
  return request.workflow_stage === "concluido" || request.status === "completed";
}

function doneAtFor(request: MarketingRequest): string | null {
  if (request.delivered_at) return request.delivered_at;
  if (request.workflow_stage === "concluido") return request.stage_changed_at ?? null;
  return null;
}

export function computeSlaReport(
  requests: MarketingRequest[],
  timeEntries: SlaTimeEntry[],
  stageChanges: SlaStageChange[]
): SlaReport {
  const effortByRequest = new Map<string, number>();
  for (const entry of timeEntries) {
    if (!entry.ended_at) continue; // timer ainda rodando
    const ms = new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
    if (!(ms > 0)) continue;
    effortByRequest.set(entry.request_id, (effortByRequest.get(entry.request_id) ?? 0) + ms);
  }

  const firstVersionByRequest = new Map<string, string>();
  const adjustmentsByRequest = new Map<string, number>();
  const stagedRequests = new Set<string>();
  for (const change of stageChanges) {
    if (!change.to_value) continue;
    stagedRequests.add(change.request_id);
    if (change.to_value === "revisao_autor") {
      adjustmentsByRequest.set(change.request_id, (adjustmentsByRequest.get(change.request_id) ?? 0) + 1);
    }
    if (FIRST_VERSION_STAGES.has(change.to_value)) {
      const prev = firstVersionByRequest.get(change.request_id);
      if (!prev || change.created_at < prev) firstVersionByRequest.set(change.request_id, change.created_at);
    }
  }

  const details: SlaRequestDetail[] = [];
  for (const request of requests) {
    if (!isConcluded(request) || !request.requested_at) continue;
    const doneAt = doneAtFor(request);
    const effortMs = effortByRequest.get(request.id) ?? 0;

    // Só mede o que passou pelo fluxo do sistema (horas apontadas ou mudança de etapa).
    // Fica de fora o histórico importado da planilha (entrega preenchida como pedido + 7 dias)
    // e peças lançadas já concluídas, como posts registrados depois de publicados.
    const hasTrace = effortMs > 0 || stagedRequests.has(request.id);
    if (!hasTrace) continue;

    const loggedFirstVersion = firstVersionByRequest.get(request.id) ?? null;
    const firstVersionAt =
      loggedFirstVersion && doneAt ? (loggedFirstVersion < doneAt ? loggedFirstVersion : doneAt) : loggedFirstVersion ?? doneAt;

    const validDone = doneAt && doneAt >= request.requested_at ? doneAt : null;
    const validFirst = firstVersionAt && firstVersionAt >= request.requested_at ? firstVersionAt : null;

    let onTime: boolean | null = null;
    if (request.deadline && validDone) {
      onTime = toLocalDate(validDone) <= request.deadline.slice(0, 10);
    }

    details.push({
      id: request.id,
      title: request.title,
      type: request.request_type || "Sem tipo",
      requestedAt: request.requested_at,
      firstVersionAt: validFirst,
      doneAt: validDone,
      firstVersionBusinessDays: validFirst ? businessDaysBetween(request.requested_at, validFirst) : null,
      doneBusinessDays: validDone ? businessDaysBetween(request.requested_at, validDone) : null,
      effortHours: effortMs > 0 ? effortMs / 3_600_000 : null,
      adjustmentRounds: adjustmentsByRequest.get(request.id) ?? 0,
      deadline: request.deadline ?? null,
      onTime,
    });
  }

  const byType = new Map<string, SlaRequestDetail[]>();
  for (const detail of details) {
    const list = byType.get(detail.type) ?? [];
    list.push(detail);
    byType.set(detail.type, list);
  }

  const rows: SlaTypeRow[] = [...byType.entries()].map(([type, items]) => {
    const effort = stat(items.flatMap((d) => (d.effortHours != null ? [d.effortHours] : [])));
    const firstVersion = stat(items.flatMap((d) => (d.firstVersionBusinessDays != null ? [d.firstVersionBusinessDays] : [])));
    const done = stat(items.flatMap((d) => (d.doneBusinessDays != null ? [d.doneBusinessDays] : [])));
    const withDeadline = items.filter((d) => d.onTime != null);
    const adjustmentSample = items.filter((d) => stagedRequests.has(d.id));

    return {
      type,
      concluidas: items.length,
      esforcoHoras: effort,
      primeiraVersaoDias: firstVersion,
      conclusaoDias: done,
      ajustesMedia: adjustmentSample.length
        ? adjustmentSample.reduce((a, d) => a + d.adjustmentRounds, 0) / adjustmentSample.length
        : null,
      pctComAjuste: adjustmentSample.length
        ? adjustmentSample.filter((d) => d.adjustmentRounds > 0).length / adjustmentSample.length
        : null,
      comPrazo: withDeadline.length,
      noPrazo: withDeadline.filter((d) => d.onTime).length,
      sugestao: {
        esforcoHoras: roundUpQuarterHour(effort.p80),
        primeiraVersaoDias: roundUpDays(firstVersion.p80),
        conclusaoDias: roundUpDays(done.p80),
      },
      confianca: confidenceFor(effort.amostra),
    };
  });

  rows.sort((a, b) => b.concluidas - a.concluidas);
  return { rows, details };
}

export interface ArrivalStats {
  /** Solicitações por dia em que chegou alguma (mediana). */
  typicalPerDay: number | null;
  peak: number;
  /** % dos dias com chegada que receberam 4 ou mais de uma vez. */
  pctBatchDays: number | null;
}

export const BATCH_THRESHOLD = 4;

export function computeArrivalStats(requests: MarketingRequest[]): ArrivalStats {
  const byDay = new Map<string, number>();
  for (const request of requests) {
    if (!request.requested_at) continue;
    const key = toLocalDate(request.requested_at);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const counts = [...byDay.values()];
  if (counts.length === 0) return { typicalPerDay: null, peak: 0, pctBatchDays: null };
  return {
    typicalPerDay: percentile(counts, 0.5),
    peak: Math.max(...counts),
    pctBatchDays: counts.filter((n) => n >= BATCH_THRESHOLD).length / counts.length,
  };
}

/** Segunda-feira (YYYY-MM-DD) da semana da data, no fuso de São Paulo. */
export function weekKey(iso: string): string {
  const date = new Date(`${toLocalDate(iso)}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

/** Semanas no quartil mais pesado de horas pedidas contam como "semana cheia". */
const BUSY_WEEK_PERCENTILE = 0.75;

export interface WeeklyLoad {
  weeks: number;
  busyWeeks: Set<string>;
  /** Horas de produção pedidas a partir das quais a semana é cheia. */
  busyThresholdHours: number;
  typicalRequests: number;
  typicalHours: number;
  busyRequestsMin: number;
  busyRequestsMax: number;
  maxHours: number;
  /** Horas apontadas no timesheet por semana. */
  loggedTypical: number | null;
  loggedStrong: number | null;
  loggedMax: number | null;
  /** Média de pedidos por tipo numa semana cheia, do maior para o menor. */
  busyMix: { type: string; perWeek: number }[];
}

/**
 * Carga semanal: horas de produção pedidas por semana de chegada. A hora de cada
 * pedido é a apontada nele ou, se ainda não tem apontamento, a média do tipo.
 * Semanas antes do primeiro registro no sistema ficam de fora (planilha antiga).
 */
export function computeWeeklyLoad(
  requests: MarketingRequest[],
  report: SlaReport,
  timeEntries: SlaTimeEntry[],
  stageChanges: SlaStageChange[]
): WeeklyLoad | null {
  const traces = [...timeEntries.map((e) => e.started_at), ...stageChanges.map((c) => c.created_at)];
  if (traces.length === 0) return null;
  const systemStart = weekKey(traces.reduce((min, t) => (t < min ? t : min)));

  const effort = new Map<string, number>();
  for (const entry of timeEntries) {
    if (!entry.ended_at) continue;
    const ms = new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
    if (ms > 0) effort.set(entry.request_id, (effort.get(entry.request_id) ?? 0) + ms / 3_600_000);
  }
  const averageByType = new Map<string, number>();
  for (const row of report.rows) {
    if (row.esforcoHoras.media != null) averageByType.set(row.type, row.esforcoHoras.media);
  }
  const fallback = percentile([...effort.values()], 0.5) ?? 1;

  const weeks = new Map<string, { requests: number; hours: number; types: Map<string, number> }>();
  const requestIds = new Set<string>();
  for (const request of requests) {
    if (!request.requested_at) continue;
    const key = weekKey(request.requested_at);
    if (key < systemStart) continue;
    requestIds.add(request.id);
    const type = request.request_type || "Sem tipo";
    const hours = effort.get(request.id) ?? averageByType.get(type) ?? fallback;
    const week = weeks.get(key) ?? { requests: 0, hours: 0, types: new Map<string, number>() };
    week.requests++;
    week.hours += hours;
    week.types.set(type, (week.types.get(type) ?? 0) + 1);
    weeks.set(key, week);
  }
  if (weeks.size === 0) return null;

  const hoursPerWeek = [...weeks.values()].map((w) => w.hours);
  const busyThresholdHours = percentile(hoursPerWeek, BUSY_WEEK_PERCENTILE) ?? 0;
  const busy = [...weeks.entries()].filter(([, w]) => w.hours >= busyThresholdHours);

  const mix = new Map<string, number>();
  for (const [, week] of busy) {
    for (const [type, n] of week.types) mix.set(type, (mix.get(type) ?? 0) + n);
  }

  const loggedByWeek = new Map<string, number>();
  for (const entry of timeEntries) {
    if (!entry.ended_at || !requestIds.has(entry.request_id)) continue;
    const ms = new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
    if (!(ms > 0)) continue;
    const key = weekKey(entry.started_at);
    loggedByWeek.set(key, (loggedByWeek.get(key) ?? 0) + ms / 3_600_000);
  }
  const logged = [...loggedByWeek.values()];
  const busyCounts = busy.map(([, w]) => w.requests);

  return {
    weeks: weeks.size,
    busyWeeks: new Set(busy.map(([key]) => key)),
    busyThresholdHours,
    typicalRequests: percentile([...weeks.values()].map((w) => w.requests), 0.5) ?? 0,
    typicalHours: percentile(hoursPerWeek, 0.5) ?? 0,
    busyRequestsMin: Math.min(...busyCounts),
    busyRequestsMax: Math.max(...busyCounts),
    maxHours: Math.max(...hoursPerWeek),
    loggedTypical: percentile(logged, 0.5),
    loggedStrong: percentile(logged, 0.8),
    loggedMax: logged.length ? Math.max(...logged) : null,
    busyMix: [...mix.entries()]
      .map(([type, n]) => ({ type, perWeek: n / busy.length }))
      .sort((a, b) => b.perWeek - a.perWeek),
  };
}

export interface SlaPolicy {
  type: string;
  /** Prazo da 1ª versão, em dias úteis. */
  firstVersionDays: number;
  /** Prazo de cada rodada de ajuste, em dias úteis. */
  adjustmentDays: number;
  note?: string;
}

export interface SlaHitRate {
  hit: number;
  total: number;
}

export interface SlaPolicyResult {
  type: string;
  policy: SlaPolicy | null;
  stats: SlaTypeRow;
  /** Dias úteis em que 80% das peças saíram (1ª versão) só nas semanas cheias. */
  busyFirstVersionP80: number | null;
  all: SlaHitRate;
  busy: SlaHitRate;
}

/** Quantas peças do período teriam cumprido o prazo proposto, no geral e nas semanas cheias. */
export function evaluateSlaPolicy(
  report: SlaReport,
  busyWeeks: Set<string>,
  policies: SlaPolicy[]
): { rows: SlaPolicyResult[]; all: SlaHitRate; busy: SlaHitRate } {
  const byType = new Map(policies.map((p) => [p.type, p]));
  const totalAll: SlaHitRate = { hit: 0, total: 0 };
  const totalBusy: SlaHitRate = { hit: 0, total: 0 };

  const rows = report.rows.map((stats) => {
    const policy = byType.get(stats.type) ?? null;
    const items = report.details.filter((d) => d.type === stats.type && d.firstVersionBusinessDays != null);
    const busyItems = items.filter((d) => busyWeeks.has(weekKey(d.requestedAt)));
    const count = (list: SlaRequestDetail[]): SlaHitRate => ({
      hit: policy ? list.filter((d) => (d.firstVersionBusinessDays ?? Infinity) <= policy.firstVersionDays).length : 0,
      total: list.length,
    });
    const all = count(items);
    const busy = count(busyItems);
    if (policy) {
      totalAll.hit += all.hit;
      totalAll.total += all.total;
      totalBusy.hit += busy.hit;
      totalBusy.total += busy.total;
    }
    return {
      type: stats.type,
      policy,
      stats,
      busyFirstVersionP80: percentile(busyItems.map((d) => d.firstVersionBusinessDays as number), 0.8),
      all,
      busy,
    };
  });

  return { rows, all: totalAll, busy: totalBusy };
}

/** "1h 30min", "45min". */
export function formatHours(hours: number | null): string {
  if (hours == null) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/** "mesmo dia", "1 dia útil", "2,5 dias úteis". */
export function formatBusinessDays(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "mesmo dia";
  const rounded = Math.round(days * 10) / 10;
  const label = rounded.toLocaleString("pt-BR");
  return rounded === 1 ? "1 dia útil" : `${label} dias úteis`;
}
