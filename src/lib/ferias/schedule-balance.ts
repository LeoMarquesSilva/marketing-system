import { generateAccrualPeriods, todayISO } from "@/lib/ferias/balance";

function daysLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Direito que passa a contar entre duas datas (períodos aquisitivos que fecham). */
export function entitledGainedBetween(
  admissionDate: string,
  fromDate: string,
  toDate: string
): number {
  if (!admissionDate || !fromDate || !toDate || toDate <= fromDate) return 0;
  const before = generateAccrualPeriods(admissionDate, fromDate);
  const after = generateAccrualPeriods(admissionDate, toDate);
  const sum = (periods: Array<{ entitled_days: number }>) =>
    periods.reduce((total, period) => total + period.entitled_days, 0);
  return Math.max(0, sum(after) - sum(before));
}

export function simulateScheduledShortfall(input: {
  pendingDays: number;
  admissionDate: string;
  leaves: Array<{ start_date: string; days: number }>;
  referenceDate?: string;
}): number {
  let remaining = input.pendingDays;
  let cursor = input.referenceDate ?? todayISO();
  const leaves = [...input.leaves].sort((a, b) => a.start_date.localeCompare(b.start_date));
  let worst = remaining;
  for (const leave of leaves) {
    remaining += entitledGainedBetween(input.admissionDate, cursor, leave.start_date);
    if (leave.start_date > cursor) cursor = leave.start_date;
    remaining -= leave.days;
    worst = Math.min(worst, remaining);
  }
  return Math.max(0, -worst);
}

export function scheduledExceedsBalanceWarning(input: {
  pendingDays: number;
  unallocatedDays: number;
  scheduledDays: number;
  admissionDate?: string;
  scheduledLeaves?: Array<{ start_date: string; days: number }>;
  referenceDate?: string;
}): string | null {
  if (input.unallocatedDays > 0 || input.scheduledDays <= 0) return null;

  const shortfall =
    input.admissionDate && input.scheduledLeaves && input.scheduledLeaves.length > 0
      ? simulateScheduledShortfall({
          pendingDays: input.pendingDays,
          admissionDate: input.admissionDate,
          leaves: input.scheduledLeaves,
          referenceDate: input.referenceDate,
        })
      : Math.max(0, input.scheduledDays - Math.max(0, input.pendingDays));

  if (shortfall <= 0) return null;
  const saldo = Math.max(0, input.pendingDays);
  return `Tem ${daysLabel(saldo, "dia", "dias")} de saldo e ${daysLabel(input.scheduledDays, "dia programado", "dias programados")} sem novo direito suficiente até essas datas. Quando o gozo começar, ficará devendo ${daysLabel(shortfall, "dia", "dias")}.`;
}

export function debitExceedsAvailableBalance(input: {
  days: number;
  startDate: string;
  pendingDays: number;
  admissionDate: string;
  otherScheduledLeaves?: Array<{ start_date: string; days: number }>;
  editingConsumedDays?: number;
  referenceDate?: string;
}): { available: number; shortfall: number; message: string } | null {
  if (!input.startDate || input.days < 1 || !input.admissionDate) return null;

  const referenceDate = input.referenceDate ?? todayISO();
  const events = [
    ...(input.otherScheduledLeaves ?? []).map((leave) => ({ ...leave, target: false })),
    { start_date: input.startDate, days: input.days, target: true },
  ].sort((a, b) => {
    const byDate = a.start_date.localeCompare(b.start_date);
    if (byDate !== 0) return byDate;
    return Number(a.target) - Number(b.target);
  });

  let remaining = input.pendingDays + (input.editingConsumedDays ?? 0);
  let cursor = referenceDate;
  for (const event of events) {
    remaining += entitledGainedBetween(input.admissionDate, cursor, event.start_date);
    if (event.start_date > cursor) cursor = event.start_date;
    if (event.target) {
      if (remaining >= input.days) return null;
      const available = Math.max(0, remaining);
      const shortfall = input.days - remaining;
      return {
        available,
        shortfall,
        message: `Tem ${daysLabel(available, "dia", "dias")} de saldo nessa data e o lançamento é de ${daysLabel(input.days, "dia", "dias")}. Ficará devendo ${daysLabel(shortfall, "dia", "dias")}. Confirma mesmo assim?`,
      };
    }
    remaining -= event.days;
  }
  return null;
}
