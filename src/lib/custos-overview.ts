import type { SupabaseBillingDashboard } from "@/lib/supabase-billing";
import type { InfraServicesDashboard } from "@/lib/infra-services";
import type { HostingerBillingDashboard } from "@/lib/hostinger-billing";
import { matchesPeriodFilter, type CustosPeriodFilter } from "@/lib/custos-period-filter";

/** Fallback quando não há nenhum pagamento com as duas moedas para inferir a cotação. */
export const FALLBACK_USD_BRL = 5.4;

export type CustosCategoryId = "supabase" | "cursor" | "n8n";

export interface CustosCategoryOverview {
  id: CustosCategoryId;
  label: string;
  monthlyBrl: number;
  /** Classe Tailwind para a barra de proporção. */
  barClass: string;
  /** Classe Tailwind para o ponto/legenda. */
  dotClass: string;
}

export interface CustosOverview {
  /** Run-rate mensal atual somando todas as categorias, em BRL. */
  totalMonthlyBrl: number;
  /** Total mensal em USD (apenas categorias cobradas em dólar). */
  totalMonthlyUsd: number;
  categories: CustosCategoryOverview[];
  /** Pago no período do filtro, consolidado em BRL. */
  paidBrl: number;
  /** Cotação USD→BRL usada nas conversões. */
  rate: number;
  /** true = inferida de pagamentos reais; false = fallback. */
  rateInferred: boolean;
  nextDue: string | null;
}

/**
 * Infere a cotação USD→BRL a partir do pagamento mais recente que tenha as duas
 * moedas (ou cotação salva). Evita depender de chamada externa ao renderizar.
 */
export function inferUsdBrlRate(
  data: SupabaseBillingDashboard | null,
  servicesData: InfraServicesDashboard | null
): { rate: number; inferred: boolean } {
  let bestDate = "";
  let bestRate = 0;

  const consider = (
    dateIso: string | null | undefined,
    usd: number | null | undefined,
    brl: number | null | undefined,
    storedRate?: number | null
  ) => {
    let r = storedRate ?? null;
    if ((r == null || !(r > 0)) && usd && brl && usd > 0) r = brl / usd;
    if (r == null || !(r > 0)) return;
    const d = (dateIso ?? "").slice(0, 10);
    if (d >= bestDate) {
      bestDate = d;
      bestRate = r;
    }
  };

  for (const org of data?.organizations ?? []) {
    for (const h of org.orgPaymentHistory ?? []) {
      consider(h.periodEnd, h.amountUsd, h.amountBrl, h.usdBrlRate);
    }
    for (const project of org.projects) {
      for (const h of project.paymentHistory) {
        consider(h.periodEnd, h.amountUsd, h.amountBrl, h.usdBrlRate);
      }
    }
  }
  for (const s of servicesData?.services ?? []) {
    for (const p of s.payments) {
      consider(p.paid_at ?? p.period_month, p.amount_usd, p.amount_brl, p.usd_brl_rate);
    }
  }

  if (bestRate > 0) return { rate: bestRate, inferred: true };
  return { rate: FALLBACK_USD_BRL, inferred: false };
}

/** Pago no período (filtro), consolidado em BRL — converte USD quando falta o BRL. */
export function sumPaidBrl(
  data: SupabaseBillingDashboard | null,
  servicesData: InfraServicesDashboard | null,
  filter: CustosPeriodFilter,
  rate: number
): number {
  let brl = 0;

  for (const org of data?.organizations ?? []) {
    for (const h of org.orgPaymentHistory ?? []) {
      if (!matchesPeriodFilter(h.periodEnd, filter)) continue;
      brl += h.amountBrl ?? h.amountUsd * rate;
    }
    for (const project of org.projects) {
      for (const h of project.paymentHistory) {
        if (!matchesPeriodFilter(h.periodEnd, filter)) continue;
        brl += h.amountBrl ?? h.amountUsd * rate;
      }
    }
  }
  for (const s of servicesData?.services ?? []) {
    for (const p of s.payments) {
      if (!matchesPeriodFilter(p.period_month, filter)) continue;
      const b = Number(p.amount_brl) || 0;
      brl += b > 0 ? b : (Number(p.amount_usd) || 0) * rate;
    }
  }

  return brl;
}

/**
 * Calcula o panorama consolidado: run-rate mensal por categoria (em BRL),
 * total e pago no período. Supabase/Cursor são cobrados em USD e convertidos;
 * N8N/VPS já é cobrado em BRL (usa o preço de renovação da Hostinger quando disponível).
 */
export function computeOverview(
  data: SupabaseBillingDashboard | null,
  servicesData: InfraServicesDashboard | null,
  hostingerData: HostingerBillingDashboard | null,
  filter: CustosPeriodFilter
): CustosOverview {
  const { rate, inferred } = inferUsdBrlRate(data, servicesData);

  const supabaseUsd = data?.totalEstimated ?? 0;

  const cursor = servicesData?.services.find((s) => s.slug === "cursor") ?? null;
  const cursorUsd =
    cursor?.estimatedMonthlyUsd || Number(cursor?.monthly_amount_usd) || 0;

  const n8n = servicesData?.services.find((s) => s.slug === "n8n-vps") ?? null;
  const hostSub = hostingerData?.subscription ?? null;
  const n8nBrl =
    hostSub?.renewalPrice ||
    n8n?.estimatedMonthlyBrl ||
    Number(n8n?.monthly_amount_brl) ||
    0;

  const categories: CustosCategoryOverview[] = [
    {
      id: "supabase",
      label: "Supabase",
      monthlyBrl: supabaseUsd * rate,
      barClass: "bg-emerald-500",
      dotClass: "bg-emerald-500",
    },
    {
      id: "cursor",
      label: "Cursor",
      monthlyBrl: cursorUsd * rate,
      barClass: "bg-slate-800 dark:bg-slate-300",
      dotClass: "bg-slate-800 dark:bg-slate-300",
    },
    {
      id: "n8n",
      label: "N8N / VPS",
      monthlyBrl: n8nBrl,
      barClass: "bg-orange-500",
      dotClass: "bg-orange-500",
    },
  ];

  const totalMonthlyBrl = categories.reduce((s, c) => s + c.monthlyBrl, 0);
  const totalMonthlyUsd = supabaseUsd + cursorUsd;

  return {
    totalMonthlyBrl,
    totalMonthlyUsd,
    categories,
    paidBrl: sumPaidBrl(data, servicesData, filter, rate),
    rate,
    rateInferred: inferred,
    nextDue: hostSub?.nextBillingAt ?? hostSub?.expiresAt ?? null,
  };
}
