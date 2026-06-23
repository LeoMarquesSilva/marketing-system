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

function getAdminClient() {
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, supabaseServiceKey);
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
