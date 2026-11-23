/**
 * Datas e situação do plano de manutenção (Facilities > Manutenção).
 *
 * A próxima data sai da última execução + o intervalo da periodicidade. Pontual
 * e emergencial não se repetem: depois de feitas, o plano fica concluído.
 */

import { addDays, addMonths, daysBetween } from "./alerts";

export const MAINTENANCE_TYPES = ["preventiva", "corretiva"] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];
export const MAINTENANCE_TYPE_LABEL: Record<MaintenanceType, string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
};

export const MAINTENANCE_PERIODICITIES = [
  "pontual",
  "emergencial",
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
  "personalizada",
] as const;
export type MaintenancePeriodicity = (typeof MAINTENANCE_PERIODICITIES)[number];

export const PERIODICITY_INFO: Record<MaintenancePeriodicity, { label: string; hint: string }> = {
  pontual: { label: "Pontual", hint: "Conforme a necessidade" },
  // O gestor deixou a aplicação da emergencial em branco.
  emergencial: { label: "Emergencial", hint: "" },
  semanal: { label: "Semanal", hint: "Verificações frequentes" },
  quinzenal: { label: "Quinzenal", hint: "Inspeções recorrentes" },
  mensal: { label: "Mensal", hint: "Manutenções de rotina" },
  bimestral: { label: "Bimestral", hint: "A cada dois meses" },
  trimestral: { label: "Trimestral", hint: "A cada três meses" },
  semestral: { label: "Semestral", hint: "A cada seis meses" },
  anual: { label: "Anual", hint: "Uma vez ao ano" },
  personalizada: { label: "Personalizada", hint: "Intervalo definido pelo responsável" },
};

/** Periodicidades que não se repetem. */
export function isOneOff(periodicity: MaintenancePeriodicity): boolean {
  return periodicity === "pontual" || periodicity === "emergencial";
}

const MONTHS: Partial<Record<MaintenancePeriodicity, number>> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Próxima data a partir de uma execução; null para pontual/emergencial. */
export function nextDueAfter(
  doneOn: string,
  periodicity: MaintenancePeriodicity,
  customIntervalDays: number | null
): string | null {
  if (isOneOff(periodicity)) return null;
  if (periodicity === "semanal") return addDays(doneOn, 7);
  if (periodicity === "quinzenal") return addDays(doneOn, 15);
  if (periodicity === "personalizada") return customIntervalDays ? addDays(doneOn, customIntervalDays) : null;
  return addMonths(doneOn, MONTHS[periodicity] ?? 1);
}

/** Dias antes da data em que o plano passa a "próximo do vencimento". */
export function warningWindow(periodicity: MaintenancePeriodicity, customIntervalDays: number | null): number {
  if (periodicity === "semanal") return 2;
  if (periodicity === "quinzenal") return 4;
  if (periodicity === "personalizada") return Math.max(2, Math.min(30, Math.round((customIntervalDays ?? 30) / 4)));
  if (periodicity === "mensal") return 7;
  return 15;
}

export type MaintenanceSituation = "atrasada" | "proxima" | "em_dia" | "sem_data" | "pausada" | "concluida";

export const SITUATION_LABEL: Record<MaintenanceSituation, string> = {
  atrasada: "Atrasada",
  proxima: "Próxima do vencimento",
  em_dia: "Em dia",
  sem_data: "Sem data prevista",
  pausada: "Pausada",
  concluida: "Concluída",
};

export interface PlanDates {
  status: "ativo" | "pausado" | "concluido";
  periodicity: MaintenancePeriodicity;
  custom_interval_days: number | null;
  next_due_on: string | null;
}

/**
 * Datas previstas do plano entre `from` e `to` (agenda e custo previsto).
 * Plano atrasado conta a primeira em `from`: ainda precisa ser feito.
 */
export function occurrencesBetween(plan: PlanDates, from: string, to: string): string[] {
  if (plan.status !== "ativo" || !plan.next_due_on) return [];
  const dates: string[] = [];
  let date: string | null = plan.next_due_on < from ? from : plan.next_due_on;
  while (date && date <= to && dates.length < 400) {
    dates.push(date);
    date = nextDueAfter(date, plan.periodicity, plan.custom_interval_days);
  }
  return dates;
}

/** Modelos comuns em escritórios: só preenchem o formulário, tudo pode ser trocado. */
export const MAINTENANCE_TEMPLATES: Array<{
  title: string;
  assetCategory: string;
  periodicity: MaintenancePeriodicity;
  note: string;
}> = [
  { title: "PMOC do ar-condicionado", assetCategory: "ar_condicionado", periodicity: "mensal", note: "Ambientes climatizados (Lei 13.589/2018)" },
  { title: "Manutenção do elevador", assetCategory: "elevador", periodicity: "mensal", note: "Conservação pela empresa contratada" },
  { title: "Recarga e inspeção dos extintores", assetCategory: "seguranca_incendio", periodicity: "anual", note: "Validade da carga e do lacre" },
  { title: "Limpeza da caixa d'água", assetCategory: "hidraulica", periodicity: "semestral", note: "Com laudo de potabilidade" },
  { title: "Dedetização e controle de pragas", assetCategory: "predial", periodicity: "semestral", note: "Com certificado da empresa" },
  { title: "Revisão do gerador e nobreak", assetCategory: "gerador", periodicity: "trimestral", note: "Teste de carga e baterias" },
];

export function planSituation(plan: PlanDates, today: string): { situation: MaintenanceSituation; days: number | null } {
  if (plan.status === "pausado") return { situation: "pausada", days: null };
  if (plan.status === "concluido") return { situation: "concluida", days: null };
  if (!plan.next_due_on) return { situation: "sem_data", days: null };
  const days = daysBetween(today, plan.next_due_on);
  if (days < 0) return { situation: "atrasada", days };
  if (days <= warningWindow(plan.periodicity, plan.custom_interval_days)) return { situation: "proxima", days };
  return { situation: "em_dia", days };
}
