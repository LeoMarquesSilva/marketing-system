import type { InfraServiceWithPayments } from "@/lib/infra-services";
import type { SupabaseBillingDashboard } from "@/lib/supabase-billing";

export interface CustosPeriodFilter {
  year: number;
  /** 1–12, ou null = ano inteiro */
  month: number | null;
}

export const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export function parsePeriodDate(iso: string): { year: number; month: number } {
  const d = new Date(iso.includes("T") ? iso : `${iso.slice(0, 10)}T12:00:00`);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function matchesPeriodFilter(iso: string, filter: CustosPeriodFilter): boolean {
  const { year, month } = parsePeriodDate(iso);
  if (year !== filter.year) return false;
  if (filter.month == null) return true;
  return month === filter.month;
}

export function formatPeriodFilterLabel(filter: CustosPeriodFilter): string {
  if (filter.month == null) return String(filter.year);
  const name = MONTH_LABELS[filter.month - 1] ?? String(filter.month);
  return `${name} de ${filter.year}`;
}

export function isCurrentPeriod(filter: CustosPeriodFilter): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (filter.year !== currentYear) return false;
  if (filter.month == null) return true;
  return filter.month === currentMonth;
}

export function collectAvailableYears(
  data: SupabaseBillingDashboard | null,
  servicesData: { services: InfraServiceWithPayments[] } | null
): number[] {
  const years = new Set<number>([new Date().getFullYear()]);

  for (const org of data?.organizations ?? []) {
    for (const project of org.projects) {
      for (const h of project.paymentHistory) {
        years.add(parsePeriodDate(h.periodEnd).year);
      }
    }
  }

  for (const service of servicesData?.services ?? []) {
    for (const p of service.payments) {
      years.add(parsePeriodDate(p.period_month).year);
    }
  }

  return [...years].sort((a, b) => b - a);
}

export function sumFilteredPayments(
  data: SupabaseBillingDashboard | null,
  servicesData: { services: InfraServiceWithPayments[] } | null,
  filter: CustosPeriodFilter
): { usd: number; brl: number } {
  let usd = 0;
  let brl = 0;

  for (const org of data?.organizations ?? []) {
    for (const project of org.projects) {
      for (const h of project.paymentHistory) {
        if (!matchesPeriodFilter(h.periodEnd, filter)) continue;
        usd += h.amountUsd;
        brl += h.amountBrl ?? 0;
      }
    }
  }

  for (const service of servicesData?.services ?? []) {
    for (const p of service.payments) {
      if (!matchesPeriodFilter(p.period_month, filter)) continue;
      usd += Number(p.amount_usd) || 0;
      brl += Number(p.amount_brl) || 0;
    }
  }

  return { usd, brl };
}
