/**
 * Cálculo de saldo de férias a partir da ficha do RH.
 *
 * Cada período aquisitivo dura 12 meses a partir da admissão e dá direito a 30
 * dias. O período concessivo são os 12 meses seguintes, prazo em que as férias
 * precisam ser gozadas. Os gozos são consumidos em FIFO contra os períodos mais
 * antigos com saldo, que é como a ficha em planilha é lida hoje.
 */

import type {
  EmployeeBalance,
  LeaveAllocation,
  PeriodBalance,
  VacationLeave,
  VacationPeriod,
  VacationPeriodStatus,
} from "@/lib/ferias/types";
import { isVacationCreditKind } from "@/lib/ferias/types";

export const DEFAULT_ENTITLED_DAYS = 30;
/** Janela de alerta antes do fim do período concessivo. */
export const DUE_SOON_DAYS = 90;
const MS_PER_DAY = 86_400_000;
const DAYS_ACCRUED_PER_MONTH = 2.5;

/** Data ISO (YYYY-MM-DD) para Date em UTC, evitando deslocamento de fuso. */
export function parseISODate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, amount: number): string {
  const date = parseISODate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return toISODate(date);
}

export function addYears(value: string, amount: number): string {
  const date = parseISODate(value);
  date.setUTCFullYear(date.getUTCFullYear() + amount);
  return toISODate(date);
}

export function diffInDays(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / MS_PER_DAY);
}

/** Dias corridos entre início e fim, inclusive nas duas pontas. */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  return diffInDays(startDate, endDate) + 1;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export interface GeneratedPeriod {
  period_start: string;
  period_end: string;
  concessive_start: string;
  concessive_end: string;
  entitled_days: number;
}

/**
 * Períodos aquisitivos já completados até a data de referência. O período em
 * curso fica de fora: entra no saldo apenas como proporcional.
 */
export function generateAccrualPeriods(
  admissionDate: string,
  referenceDate: string = todayISO(),
  entitledDays: number = DEFAULT_ENTITLED_DAYS
): GeneratedPeriod[] {
  const periods: GeneratedPeriod[] = [];
  // Teto defensivo: evita laço infinito com data de admissão inválida.
  for (let index = 0; index < 60; index += 1) {
    const periodStart = addYears(admissionDate, index);
    const periodEnd = addDays(addYears(admissionDate, index + 1), -1);
    if (diffInDays(periodEnd, referenceDate) < 0) break;
    periods.push({
      period_start: periodStart,
      period_end: periodEnd,
      concessive_start: addDays(periodEnd, 1),
      concessive_end: addDays(addYears(addDays(periodEnd, 1), 1), -1),
      entitled_days: entitledDays,
    });
  }
  return periods;
}

/** Período aquisitivo em curso na data de referência, com proporcional. */
export function currentAccrualPeriod(
  admissionDate: string,
  referenceDate: string = todayISO(),
  entitledDays: number = DEFAULT_ENTITLED_DAYS
): EmployeeBalance["currentPeriod"] {
  const completed = generateAccrualPeriods(admissionDate, referenceDate, entitledDays);
  const periodStart = addYears(admissionDate, completed.length);
  if (diffInDays(periodStart, referenceDate) < 0) return null;
  const periodEnd = addDays(addYears(admissionDate, completed.length + 1), -1);

  const start = parseISODate(periodStart);
  const reference = parseISODate(referenceDate);
  let months =
    (reference.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (reference.getUTCMonth() - start.getUTCMonth());
  if (reference.getUTCDate() < start.getUTCDate()) months -= 1;
  months = Math.max(0, months);

  return {
    periodStart,
    periodEnd,
    accruedDays: Math.min(entitledDays, months * DAYS_ACCRUED_PER_MONTH),
  };
}

/**
 * Status do saldo remanescente de um período aquisitivo.
 * "Vencido" só após o fim do período concessivo (CLT art. 134/137).
 * No último dia do concessivo ainda é "a vencer" — dá para iniciar o gozo hoje.
 */
function resolvePeriodStatus(
  remainingDays: number,
  daysUntilDeadline: number
): VacationPeriodStatus {
  if (remainingDays <= 0) return "quitado";
  if (daysUntilDeadline < 0) return "vencido";
  if (daysUntilDeadline <= DUE_SOON_DAYS) return "a_vencer";
  return "em_dia";
}

const STATUS_SEVERITY: Record<VacationPeriodStatus, number> = {
  quitado: 0,
  em_dia: 1,
  a_vencer: 2,
  vencido: 3,
};

export interface ComputeBalanceInput {
  admissionDate: string;
  periods: VacationPeriod[];
  leaves: VacationLeave[];
  referenceDate?: string;
}

export function computeEmployeeBalance({
  admissionDate,
  periods,
  leaves,
  referenceDate = todayISO(),
}: ComputeBalanceInput): EmployeeBalance {
  const sortedPeriods = [...periods].sort((a, b) => a.period_start.localeCompare(b.period_start));
  const allDebitLeaves = [...leaves].filter((leave) => !isVacationCreditKind(leave.kind));
  // Só o que já começou consome o saldo. Uma férias "a programar" (início no
  // futuro) não pode descontar dias de quem ainda não chegou lá — o dia ainda
  // não chegou, então o direito continua inteiro até a data de início.
  const debitLeaves = allDebitLeaves
    .filter((leave) => leave.start_date <= referenceDate)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const scheduledLeaves = allDebitLeaves
    .filter((leave) => leave.start_date > referenceDate)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const creditLeaves = [...leaves]
    .filter((leave) => isVacationCreditKind(leave.kind))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const allocationsByPeriod = new Map<string, LeaveAllocation[]>();
  const usedByPeriod = new Map<string, number>();
  let unallocatedDays = 0;
  let periodIndex = 0;

  // Débitos (férias/recesso/abono) já iniciados consomem FIFO nos períodos mais antigos.
  for (const leave of debitLeaves) {
    let pending = leave.days;
    while (pending > 0 && periodIndex < sortedPeriods.length) {
      const period = sortedPeriods[periodIndex];
      const alreadyUsed = usedByPeriod.get(period.id) ?? 0;
      const capacity = period.entitled_days - alreadyUsed;
      if (capacity <= 0) {
        periodIndex += 1;
        continue;
      }
      const consumed = Math.min(capacity, pending);
      usedByPeriod.set(period.id, alreadyUsed + consumed);
      const allocations = allocationsByPeriod.get(period.id) ?? [];
      allocations.push({ leave, days: consumed });
      allocationsByPeriod.set(period.id, allocations);
      pending -= consumed;
    }
    unallocatedDays += pending;
  }

  // Créditos (dia trabalhado) devolvem saldo LIFO nos períodos mais recentes usados.
  for (const leave of creditLeaves) {
    let pending = leave.days;
    for (let index = sortedPeriods.length - 1; index >= 0 && pending > 0; index -= 1) {
      const period = sortedPeriods[index];
      const alreadyUsed = usedByPeriod.get(period.id) ?? 0;
      if (alreadyUsed <= 0) continue;
      const restored = Math.min(alreadyUsed, pending);
      usedByPeriod.set(period.id, alreadyUsed - restored);
      const allocations = allocationsByPeriod.get(period.id) ?? [];
      allocations.push({ leave, days: -restored });
      allocationsByPeriod.set(period.id, allocations);
      pending -= restored;
    }
    // Crédito sem consumo prévio: não gera “dívida” negativa; sobra é ignorada no saldo.
  }

  const periodBalances: PeriodBalance[] = sortedPeriods.map((period) => {
    const usedDays = usedByPeriod.get(period.id) ?? 0;
    const remainingDays = period.entitled_days - usedDays;
    const daysUntilDeadline = diffInDays(referenceDate, period.concessive_end);
    return {
      period,
      usedDays,
      remainingDays,
      status: resolvePeriodStatus(remainingDays, daysUntilDeadline),
      daysUntilDeadline,
      allocations: allocationsByPeriod.get(period.id) ?? [],
    };
  });

  const totalEntitledDays = sortedPeriods.reduce((sum, period) => sum + period.entitled_days, 0);
  const debitDays = debitLeaves.reduce((sum, leave) => sum + leave.days, 0);
  const creditDays = creditLeaves.reduce((sum, leave) => sum + leave.days, 0);
  const totalTakenDays = Math.max(0, debitDays - creditDays);
  const scheduledDays = scheduledLeaves.reduce((sum, leave) => sum + leave.days, 0);
  const overdueDays = periodBalances
    .filter((item) => item.status === "vencido")
    .reduce((sum, item) => sum + item.remainingDays, 0);
  const dueTodayDays = periodBalances
    .filter((item) => item.remainingDays > 0 && item.daysUntilDeadline === 0)
    .reduce((sum, item) => sum + item.remainingDays, 0);
  const dueSoonDays = periodBalances
    .filter(
      (item) =>
        item.status === "a_vencer" &&
        item.daysUntilDeadline > 0 &&
        item.daysUntilDeadline <= DUE_SOON_DAYS
    )
    .reduce((sum, item) => sum + item.remainingDays, 0);
  const onTimeDays = periodBalances
    .filter((item) => item.status === "em_dia")
    .reduce((sum, item) => sum + item.remainingDays, 0);

  const status = periodBalances.reduce<VacationPeriodStatus>(
    (worst, item) => (STATUS_SEVERITY[item.status] > STATUS_SEVERITY[worst] ? item.status : worst),
    "quitado"
  );

  const onLeaveNow =
    debitLeaves.find(
      (leave) => leave.start_date <= referenceDate && leave.end_date >= referenceDate
    ) ?? null;

  return {
    totalEntitledDays,
    totalTakenDays,
    pendingDays: totalEntitledDays - totalTakenDays,
    overdueDays,
    dueTodayDays,
    dueSoonDays,
    onTimeDays,
    unallocatedDays,
    scheduledDays,
    status,
    periods: periodBalances,
    currentPeriod: currentAccrualPeriod(admissionDate, referenceDate),
    onLeaveNow,
    scheduledLeaves,
  };
}

export const PERIOD_STATUS_LABEL: Record<VacationPeriodStatus, string> = {
  quitado: "Quitado",
  em_dia: "Em dia",
  a_vencer: "A vencer",
  vencido: "Vencido",
};

export const LEAVE_KIND_LABEL: Record<VacationLeave["kind"], string> = {
  ferias: "Férias",
  recesso: "Recesso",
  abono: "Abono",
  trabalho_recesso: "Dia trabalhado no recesso",
  trabalho_ferias: "Dia trabalhado nas férias",
};

export function formatISODateBR(value: string | null | undefined): string {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
