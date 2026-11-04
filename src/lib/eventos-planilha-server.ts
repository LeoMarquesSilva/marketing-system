import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlanejamentoDetails,
  PlanilhaAttachment,
  PlanilhaBudgetItem,
  PlanilhaQuote,
  PlanilhaSupplier,
  PlanilhaSupplierUse,
} from "@/lib/eventos-planilha";

/** O PostgREST limita o tamanho da URL: os ids vão em lotes. */
const CHUNK = 150;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function selectIn<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
  key: string,
  ids: string[]
): Promise<T[]> {
  const results = await Promise.all(
    chunks(ids).map(async (part) => {
      const { data, error } = await db.from(table).select(columns).in(key, part);
      if (error) throw new Error(`Falha ao carregar ${table}: ${error.message}`);
      return (data ?? []) as T[];
    })
  );
  return results.flat();
}

type Row = Record<string, unknown>;

/**
 * Orçamento item a item, propostas, fornecedores e arquivos dos eventos da
 * planilha. Usa o cliente da sessão: o que o usuário não pode ver não entra.
 */
export async function fetchPlanejamentoDetails(
  eventIds: string[],
  db: SupabaseClient
): Promise<PlanejamentoDetails> {
  const ids = [...new Set(eventIds)];
  if (ids.length === 0) {
    return { budgetItems: [], quotes: [], suppliers: [], supplierUses: [], attachments: [] };
  }

  const [budgetRows, quoteRows, useRows, attachmentRows] = await Promise.all([
    selectIn<Row>(
      db,
      "event_budget_items",
      "event_id, category, description, vendor_name, amount_quoted, amount_planned, amount_actual, payment_status, payment_paid_date, invoice_link, receipt_link, notes, sort_order",
      "event_id",
      ids
    ),
    selectIn<Row>(
      db,
      "event_supplier_quotes",
      "event_id, supplier_id, category, included_items, quoted_value, final_value, proposal_status, attached_file_link, decision_reason, created_at",
      "event_id",
      ids
    ),
    selectIn<Row>(db, "event_supplier_event_usage", "event_id, supplier_id, role_label, notes, created_at", "event_id", ids),
    selectIn<Row>(db, "event_attachments", "event_id, title, file_type, url, is_public, created_at", "event_id", ids),
  ]);

  const supplierIds = [
    ...new Set(
      [...quoteRows, ...useRows]
        .map((row) => row.supplier_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  const supplierRows =
    supplierIds.length > 0
      ? await selectIn<Row>(
          db,
          "event_suppliers",
          "id, name, category, website_link, instagram_link, whatsapp_link, portfolio_link",
          "id",
          supplierIds
        )
      : [];

  const suppliers: PlanilhaSupplier[] = supplierRows.map((row) => ({
    id: row.id as string,
    name: str(row.name) ?? "Fornecedor sem nome",
    category: str(row.category),
    websiteLink: str(row.website_link),
    instagramLink: str(row.instagram_link),
    whatsappLink: str(row.whatsapp_link),
    portfolioLink: str(row.portfolio_link),
  }));
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const budgetItems: PlanilhaBudgetItem[] = budgetRows.map((row) => ({
    eventId: row.event_id as string,
    category: str(row.category),
    description: str(row.description),
    vendorName: str(row.vendor_name),
    amountQuoted: num(row.amount_quoted),
    amountPlanned: num(row.amount_planned),
    amountActual: num(row.amount_actual),
    paymentStatus: str(row.payment_status),
    paymentPaidDate: str(row.payment_paid_date),
    invoiceLink: str(row.invoice_link),
    receiptLink: str(row.receipt_link),
    notes: str(row.notes),
    sortOrder: num(row.sort_order) ?? 0,
  }));

  const quotes: PlanilhaQuote[] = quoteRows
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((row) => ({
      eventId: row.event_id as string,
      supplierName: supplierName.get(row.supplier_id as string) ?? null,
      scope: str(row.category),
      includedItems: str(row.included_items),
      quotedValue: num(row.quoted_value),
      finalValue: num(row.final_value),
      proposalStatus: str(row.proposal_status),
      fileLink: str(row.attached_file_link),
      decisionReason: str(row.decision_reason),
    }));

  const supplierUses: PlanilhaSupplierUse[] = useRows
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((row) => ({
      eventId: row.event_id as string,
      supplierId: row.supplier_id as string,
      roleLabel: str(row.role_label),
      notes: str(row.notes),
    }));

  const attachments: PlanilhaAttachment[] = attachmentRows
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((row) => ({
      eventId: row.event_id as string,
      title: str(row.title),
      fileType: str(row.file_type),
      url: str(row.url),
      isPublic: row.is_public === true,
    }));

  return { budgetItems, quotes, suppliers, supplierUses, attachments };
}
