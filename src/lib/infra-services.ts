import { createClient } from "@supabase/supabase-js";
import { getUsdBrlRate } from "@/lib/usd-brl-ptax";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface InfraService {
  slug: string;
  display_name: string;
  provider: string | null;
  logo_url: string | null;
  category: string | null;
  description: string | null;
  billing_url: string | null;
  monthly_amount_usd: number | null;
  monthly_amount_brl: number | null;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
}

export interface InfraServicePayment {
  id: string;
  service_slug: string;
  period_month: string;
  paid_at: string | null;
  amount_usd: number | null;
  amount_brl: number;
  usd_brl_rate: number | null;
  description: string;
  created_at: string;
}

export interface InfraServiceWithPayments extends InfraService {
  payments: InfraServicePayment[];
  totalPaidUsd: number;
  totalPaidBrl: number;
  estimatedMonthlyUsd: number;
  estimatedMonthlyBrl: number;
}

export interface InfraServicesDashboard {
  services: InfraServiceWithPayments[];
  totalEstimatedUsd: number;
  totalEstimatedBrl: number;
  totalPaidUsd: number;
  totalPaidBrl: number;
}

export interface InfraServiceInput {
  display_name?: string;
  provider?: string | null;
  logo_url?: string | null;
  category?: string | null;
  description?: string | null;
  billing_url?: string | null;
  monthly_amount_usd?: number | null;
  monthly_amount_brl?: number | null;
  sort_order?: number;
}

export interface InfraServicePaymentInput {
  period_month: string;
  paid_at?: string | null;
  amount_usd?: number | null;
  amount_brl: number;
  description?: string;
}

function getAdminClient() {
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, supabaseServiceKey);
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function loadInfraServicesDashboard(): Promise<InfraServicesDashboard> {
  const supabase = getAdminClient();

  const [{ data: services, error: sErr }, { data: payments, error: pErr }] =
    await Promise.all([
      supabase.from("infra_services").select("*").order("sort_order"),
      supabase
        .from("infra_service_payments")
        .select("*")
        .order("period_month", { ascending: false }),
    ]);

  if (sErr) throw new Error(sErr.message);
  if (pErr) throw new Error(pErr.message);

  const paymentsBySlug = new Map<string, InfraServicePayment[]>();
  for (const row of payments ?? []) {
    const list = paymentsBySlug.get(row.service_slug as string) ?? [];
    list.push(row as InfraServicePayment);
    paymentsBySlug.set(row.service_slug as string, list);
  }

  let totalEstimatedUsd = 0;
  let totalEstimatedBrl = 0;
  let totalPaidUsd = 0;
  let totalPaidBrl = 0;

  const enriched: InfraServiceWithPayments[] = (services ?? []).map((s) => {
    const svc = s as InfraService;
    const pays = paymentsBySlug.get(svc.slug) ?? [];
    const totalPaidUsdSvc = pays.reduce((sum, p) => sum + (num(p.amount_usd) ?? 0), 0);
    const totalPaidBrlSvc = pays.reduce((sum, p) => sum + (num(p.amount_brl) ?? 0), 0);
    const estUsd = num(svc.monthly_amount_usd) ?? 0;
    const estBrl = num(svc.monthly_amount_brl) ?? 0;

    totalEstimatedUsd += estUsd;
    totalEstimatedBrl += estBrl;
    totalPaidUsd += totalPaidUsdSvc;
    totalPaidBrl += totalPaidBrlSvc;

    return {
      ...svc,
      monthly_amount_usd: num(svc.monthly_amount_usd),
      monthly_amount_brl: num(svc.monthly_amount_brl),
      payments: pays,
      totalPaidUsd: totalPaidUsdSvc,
      totalPaidBrl: totalPaidBrlSvc,
      estimatedMonthlyUsd: estUsd,
      estimatedMonthlyBrl: estBrl,
    };
  });

  return {
    services: enriched,
    totalEstimatedUsd,
    totalEstimatedBrl,
    totalPaidUsd,
    totalPaidBrl,
  };
}

export async function upsertInfraService(
  slug: string,
  input: InfraServiceInput,
  updatedBy?: string
): Promise<InfraService> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("infra_services")
    .update({
      display_name: input.display_name?.trim(),
      provider: input.provider?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      billing_url: input.billing_url?.trim() || null,
      monthly_amount_usd: input.monthly_amount_usd ?? null,
      monthly_amount_brl: input.monthly_amount_brl ?? null,
      sort_order: input.sort_order ?? 0,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    })
    .eq("slug", slug)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as InfraService;
}

export async function addInfraServicePayment(
  serviceSlug: string,
  input: InfraServicePaymentInput
): Promise<InfraServicePayment> {
  const paidAt = input.paid_at ?? input.period_month;
  let rate = input.amount_usd && input.amount_brl
    ? input.amount_brl / input.amount_usd
    : null;

  if (rate == null && input.amount_brl > 0) {
    rate = await getUsdBrlRate(paidAt);
  }

  let amountUsd = input.amount_usd ?? null;
  if (amountUsd == null && input.amount_brl > 0 && rate) {
    amountUsd = Math.round((input.amount_brl / rate) * 100) / 100;
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("infra_service_payments")
    .upsert(
      {
        service_slug: serviceSlug,
        period_month: input.period_month.slice(0, 10),
        paid_at: paidAt.slice(0, 10),
        amount_usd: amountUsd,
        amount_brl: input.amount_brl,
        usd_brl_rate: rate,
        description: input.description?.trim() || `Pagamento ${input.period_month.slice(0, 7)}`,
      },
      { onConflict: "service_slug,period_month,description" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as InfraServicePayment;
}

export async function deleteInfraServicePayment(id: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("infra_service_payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export const SERVICE_LOGOS_BUCKET = "MARKETING-SYSTEM-PROJETOS";

export function publicServiceLogoUrl(path: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${SERVICE_LOGOS_BUCKET}/servicos/${path}`;
}
