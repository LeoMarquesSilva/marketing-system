import { MARX_PROJETOS_ORG_SLUG } from "@/lib/custos-projetos-config";
import { getUsdBrlRatesForDates } from "@/lib/usd-brl-ptax";
import {
  getBillingSessionToken,
  hasDedicatedBillingSessionToken,
  platformFetch,
} from "@/lib/supabase-platform-api";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface ProjectPaymentHistoryItem {
  invoiceId: string;
  invoiceNumber: string | null;
  periodEnd: string;
  description: string;
  amountUsd: number;
  usdBrlRate: number | null;
  amountBrl: number | null;
  status: string;
}

interface InvoiceListItem {
  id: string;
  number?: string;
  period_end: number;
  subtotal: number;
  status: string;
}

interface InvoiceLineBreakdown {
  project_ref?: string;
  project_name?: string;
  amount?: number;
  usage?: number;
}

interface InvoiceLine {
  amount?: number;
  description?: string;
  breakdown?: InvoiceLineBreakdown[];
}

interface InvoiceDetail {
  id: string;
  number?: string;
  period_end?: number;
  status?: string;
  lines?: InvoiceLine[];
  amount_total?: number;
}

function getAdminClient() {
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, supabaseServiceKey);
}

function centsToUsd(cents: number | null | undefined): number {
  if (cents == null || Number.isNaN(cents)) return 0;
  return cents / 100;
}

function unixToIso(seconds: number | undefined): string {
  if (!seconds) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function normalizeInvoiceList(data: unknown): InvoiceListItem[] {
  if (Array.isArray(data)) return data as InvoiceListItem[];
  if (data && typeof data === "object" && Array.isArray((data as { invoices?: unknown }).invoices)) {
    return (data as { invoices: InvoiceListItem[] }).invoices;
  }
  return [];
}

async function listInvoices(slug: string, limit = 36): Promise<InvoiceListItem[]> {
  const { data, status, error } = await platformFetch<unknown>(
    `/platform/organizations/${encodeURIComponent(slug)}/billing/invoices`,
    { offset: "0", limit: String(limit) }
  );
  if (!data || status !== 200) {
    throw new Error(error ?? `Não foi possível listar faturas (${status}).`);
  }
  return normalizeInvoiceList(data);
}

async function getInvoiceDetail(slug: string, invoiceId: string): Promise<InvoiceDetail | null> {
  const { data, status } = await platformFetch<InvoiceDetail>(
    `/platform/organizations/${encodeURIComponent(slug)}/billing/invoices/${encodeURIComponent(invoiceId)}`
  );
  if (!data || status !== 200) return null;
  return data;
}

function parseInvoiceToRows(
  slug: string,
  invoice: InvoiceListItem,
  detail: InvoiceDetail | null,
  trackedRefs: Set<string>
): Array<{
  org_slug: string;
  invoice_id: string;
  invoice_number: string | null;
  project_ref: string | null;
  project_name: string | null;
  period_end: string;
  amount_usd: number;
  description: string;
  status: string;
}> {
  const periodEnd = unixToIso(detail?.period_end ?? invoice.period_end);
  const status = detail?.status ?? invoice.status;
  const rows: Array<{
    org_slug: string;
    invoice_id: string;
    invoice_number: string | null;
    project_ref: string | null;
    project_name: string | null;
    period_end: string;
    amount_usd: number;
    description: string;
    status: string;
  }> = [];

  const lines = detail?.lines ?? [];
  if (lines.length === 0) {
    const amount = centsToUsd(invoice.subtotal);
    if (amount > 0) {
      rows.push({
        org_slug: slug,
        invoice_id: invoice.id,
        invoice_number: invoice.number ?? detail?.number ?? null,
        project_ref: "",
        project_name: null,
        period_end: periodEnd,
        amount_usd: amount,
        description: `Fatura ${invoice.number ?? invoice.id}`,
        status,
      });
    }
    return rows;
  }

  for (const line of lines) {
    const lineAmount = centsToUsd(line.amount);
    const description = line.description ?? "Item da fatura";

    if (line.breakdown?.length) {
      for (const item of line.breakdown) {
        const ref = item.project_ref ?? null;
        if (ref && trackedRefs.size > 0 && !trackedRefs.has(ref)) continue;

        const itemAmount =
          item.amount != null
            ? centsToUsd(item.amount)
            : lineAmount > 0
              ? lineAmount / line.breakdown.length
              : 0;

        if (itemAmount <= 0) continue;

        rows.push({
          org_slug: slug,
          invoice_id: invoice.id,
          invoice_number: invoice.number ?? detail?.number ?? null,
          project_ref: ref ?? "",
          project_name: item.project_name ?? null,
          period_end: periodEnd,
          amount_usd: itemAmount,
          description,
          status,
        });
      }
    } else if (lineAmount > 0) {
      rows.push({
        org_slug: slug,
        invoice_id: invoice.id,
        invoice_number: invoice.number ?? detail?.number ?? null,
        project_ref: "",
        project_name: null,
        period_end: periodEnd,
        amount_usd: lineAmount,
        description,
        status,
      });
    }
  }

  return rows;
}

export interface SyncInvoicesResult {
  synced: boolean;
  inserted: number;
  error?: string;
  needsSessionToken?: boolean;
}

export async function syncMarxProjetosInvoices(
  projectRefs: string[]
): Promise<SyncInvoicesResult> {
  const slug = MARX_PROJETOS_ORG_SLUG;
  const token = getBillingSessionToken();
  if (!token) {
    return { synced: false, inserted: 0, error: "Token de billing não configurado." };
  }

  let invoices: InvoiceListItem[];
  try {
    invoices = await listInvoices(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar faturas.";
    const needsSessionToken =
      msg.includes("JWT") || msg.includes("401") || !hasDedicatedBillingSessionToken();
    return { synced: false, inserted: 0, error: msg, needsSessionToken };
  }

  const paid = invoices.filter((i) => i.status === "paid");
  const trackedRefs = new Set(projectRefs);
  const allRows: Array<{
    org_slug: string;
    invoice_id: string;
    invoice_number: string | null;
    project_ref: string | null;
    project_name: string | null;
    period_end: string;
    amount_usd: number;
    description: string;
    status: string;
  }> = [];

  for (const invoice of paid) {
    const detail = await getInvoiceDetail(slug, invoice.id);
    allRows.push(...parseInvoiceToRows(slug, invoice, detail, trackedRefs));
  }

  if (allRows.length === 0) {
    return { synced: true, inserted: 0 };
  }

  const dates = allRows.map((r) => r.period_end.slice(0, 10));
  const rates = await getUsdBrlRatesForDates(dates);

  const payload = allRows.map((row) => {
    const day = row.period_end.slice(0, 10);
    const rate = rates.get(day) ?? null;
    const amountBrl = rate != null ? row.amount_usd * rate : null;
    return {
      ...row,
      usd_brl_rate: rate,
      amount_brl: amountBrl != null ? Math.round(amountBrl * 100) / 100 : null,
      synced_at: new Date().toISOString(),
    };
  });

  const supabase = getAdminClient();
  const { error } = await supabase.from("supabase_billing_history").upsert(payload, {
    onConflict: "org_slug,invoice_id,project_ref,description",
    ignoreDuplicates: false,
  });

  if (error) {
    return { synced: false, inserted: 0, error: error.message };
  }

  return { synced: true, inserted: payload.length };
}

export async function loadPaymentHistoryForProjects(
  orgSlug: string,
  projectRefs: string[]
): Promise<Map<string, ProjectPaymentHistoryItem[]>> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("supabase_billing_history")
    .select("*")
    .eq("org_slug", orgSlug)
    .in("status", ["paid"])
    .order("period_end", { ascending: false });

  if (error || !data) return new Map();

  const refs = new Set(projectRefs);
  const byProject = new Map<string, ProjectPaymentHistoryItem[]>();
  const orgLevel: ProjectPaymentHistoryItem[] = [];

  for (const row of data) {
    const item: ProjectPaymentHistoryItem = {
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      periodEnd: row.period_end,
      description: row.description,
      amountUsd: Number(row.amount_usd),
      usdBrlRate: row.usd_brl_rate != null ? Number(row.usd_brl_rate) : null,
      amountBrl: row.amount_brl != null ? Number(row.amount_brl) : null,
      status: row.status,
    };

    if (!row.project_ref || row.project_ref === "") {
      orgLevel.push(item);
      continue;
    }
    if (!refs.has(row.project_ref)) continue;

    const list = byProject.get(row.project_ref) ?? [];
    list.push(item);
    byProject.set(row.project_ref, list);
  }

  // Repasse proporcional de itens da org (ex.: plano Pro) entre projetos rastreados.
  if (orgLevel.length > 0 && refs.size > 0) {
    for (const orgItem of orgLevel) {
      const share = orgItem.amountUsd / refs.size;
      for (const ref of refs) {
        const list = byProject.get(ref) ?? [];
        list.push({
          ...orgItem,
          description: `${orgItem.description} (rateio org.)`,
          amountUsd: share,
          amountBrl:
            orgItem.usdBrlRate != null
              ? Math.round(share * orgItem.usdBrlRate * 100) / 100
              : null,
        });
        byProject.set(ref, list);
      }
    }
  }

  for (const [ref, list] of byProject) {
    list.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
    byProject.set(ref, list);
  }

  return byProject;
}
