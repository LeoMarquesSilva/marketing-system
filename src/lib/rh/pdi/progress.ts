/**
 * Regras de cálculo do PDI — puras, testadas em progress.test.ts.
 *
 * Percentuais iguais aos do Feedz: frente = média do progresso das suas ações, truncada;
 * plano = média dos percentuais das frentes (cada frente pesa igual), truncada.
 * Conferido nos 33 PDIs importados do Feedz em 16/11/2026 (33 de 33 iguais).
 * A média simples de todas as ações só batia em 17 de 33.
 */

import {
  PDI_DUE_SOON_DAYS,
  PDI_STALE_DAYS,
  type PdiDueState,
  type PdiKindCount,
  type PdiLearningKind,
  type PdiStatus,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayInBrasilia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

function utcMs(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/** Dias corridos de `from` até `to` (positivo quando `to` é depois). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Média simples truncada; sem ações = 0. */
export function averageProgress(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((total, value) => total + clampProgress(value), 0);
  return Math.floor(sum / values.length);
}

/** Percentual do plano: média das frentes (frentes sem ação ficam de fora). */
export function planProgress(goals: Array<{ goal_id: string; progress: number }>): number {
  const byGoal = new Map<string, number[]>();
  for (const action of goals) {
    const list = byGoal.get(action.goal_id) ?? [];
    list.push(action.progress);
    byGoal.set(action.goal_id, list);
  }
  return averageProgress([...byGoal.values()].map((values) => averageProgress(values)));
}

export function isActionOverdue(
  action: { due_date: string | null; progress: number },
  today: string
): boolean {
  return Boolean(action.due_date) && action.progress < 100 && (action.due_date as string) < today;
}

export function planDueState(
  plan: { status: PdiStatus; due_date: string },
  today: string
): PdiDueState {
  if (plan.status === "concluido") return "concluido";
  if (plan.status === "cancelado") return "cancelado";
  const left = daysBetween(today, plan.due_date);
  if (left < 0) return "atrasado";
  if (left <= PDI_DUE_SOON_DAYS) return "vence_em_breve";
  return "em_dia";
}

export function countKinds(actions: Array<{ learning_kind: PdiLearningKind | null }>): PdiKindCount {
  const count: PdiKindCount = { pratica: 0, troca: 0, formal: 0, sem: 0 };
  for (const action of actions) count[action.learning_kind ?? "sem"] += 1;
  return count;
}

/** Plano ativo sem atualização há mais de PDI_STALE_DAYS (o acompanhamento é o ponto fraco do PDI). */
export function isStale(
  plan: { status: PdiStatus; last_update_at: string | null; start_date: string },
  today: string
): boolean {
  if (plan.status !== "ativo") return false;
  const reference = plan.last_update_at ? plan.last_update_at.slice(0, 10) : plan.start_date;
  return daysBetween(reference, today) > PDI_STALE_DAYS;
}

/** "Faltam 14 dias", "Vence hoje", "Atrasado 3 dias". */
export function dueLabel(daysLeft: number, status: PdiStatus): string {
  if (status === "concluido") return "Concluído";
  if (status === "cancelado") return "Cancelado";
  if (daysLeft === 0) return "Vence hoje";
  if (daysLeft === 1) return "Falta 1 dia";
  if (daysLeft > 1) return `Faltam ${daysLeft} dias`;
  return daysLeft === -1 ? "Atrasado 1 dia" : `Atrasado ${-daysLeft} dias`;
}

/** Data ISO (YYYY-MM-DD) + N meses, segurando no último dia do mês. */
export function addMonths(iso: string, months: number): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7)) - 1 + months;
  const day = Number(iso.slice(8, 10));
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  return date.toISOString().slice(0, 10);
}
