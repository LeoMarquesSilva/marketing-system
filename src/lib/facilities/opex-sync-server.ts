import "server-only";

import { getSioeClient, isSioeSyncConfigured } from "@/lib/sioe-sync-server";
import { createFacilitiesAdminClient } from "./server";

/**
 * Traz do OPEX (banco do SIOE/financeiro) o que foi pago a cada fornecedor e grava
 * em opex_supplier_payments, agregado por mês de pagamento, departamento e plano
 * de contas. Mesmo caminho dos outros dados do SIOE: chaves SIOE_SUPABASE_* e
 * cron da Vercel (/api/cron/opex-fornecedores-sync).
 *
 * O nome do fornecedor segue o OPEX: terceiro do item, terceiro do título ou cliente.
 */

const PAGE = 1000;
export const OPEX_SYNC_MONTHS = 24;

interface ItemRow {
  id: number;
  ci_titulo: number | null;
  cliente: string | null;
  terceiro_titulo: string | null;
  terceiros_item: string | null;
  departamento: string | null;
  grupo_conta: string | null;
  plano_contas: string | null;
  valor_pago_item: number | string | null;
  data_pagamento: string | null;
}

interface Bucket {
  fornecedor: string;
  mes: string;
  departamento: string;
  grupo_conta: string;
  plano_contas: string;
  valor_pago: number;
  titulos: Set<number>;
}

export interface OpexSyncResult {
  periodStart: string;
  rows: number;
  suppliers: number;
  finishedAt: string;
}

const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function startOfPeriod(months: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)).toISOString().slice(0, 10);
}

export function isOpexSyncConfigured(): boolean {
  return isSioeSyncConfigured();
}

export async function syncOpexSupplierPayments(trigger: "cron" | "manual", months = OPEX_SYNC_MONTHS): Promise<OpexSyncResult> {
  const periodStart = startOfPeriod(Math.min(Math.max(months, 1), 60));
  const sioe = getSioeClient();
  const orq = createFacilitiesAdminClient();

  const { data: run } = await orq.from("opex_sync_runs").insert({ period_start: periodStart, trigger }).select("id").single();

  try {
    const { data: departments, error: depError } = await sioe.from("opex_v2_departamento").select("nome, tipo");
    if (depError) throw new Error(`departamentos: ${depError.message}`);
    const depType = new Map((departments ?? []).map((d) => [clean(d.nome as string), d.tipo as string]));

    const buckets = new Map<string, Bucket>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sioe
        .from("financeiro_parcelas_itens")
        .select("id, ci_titulo, cliente, terceiro_titulo, terceiros_item, departamento, grupo_conta, plano_contas, valor_pago_item, data_pagamento")
        .eq("tipo", "PAGAR")
        .gte("data_pagamento", periodStart)
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`pagamentos: ${error.message}`);
      for (const row of (data ?? []) as ItemRow[]) {
        const valor = Number(row.valor_pago_item ?? 0);
        if (!row.data_pagamento || !Number.isFinite(valor) || valor === 0) continue;
        const fornecedor = clean(row.terceiros_item) || clean(row.terceiro_titulo) || clean(row.cliente) || "—";
        const mes = `${row.data_pagamento.slice(0, 7)}-01`;
        const departamento = clean(row.departamento) || "—";
        const grupo = clean(row.grupo_conta) || "Sem grupo";
        const plano = clean(row.plano_contas) || "Sem plano";
        const key = [fornecedor, mes, departamento, grupo, plano].join("\u0001");
        const bucket = buckets.get(key) ?? {
          fornecedor,
          mes,
          departamento,
          grupo_conta: grupo,
          plano_contas: plano,
          valor_pago: 0,
          titulos: new Set<number>(),
        };
        bucket.valor_pago += valor;
        if (row.ci_titulo != null) bucket.titulos.add(row.ci_titulo);
        buckets.set(key, bucket);
      }
      if (!data || data.length < PAGE) break;
    }

    const syncedAt = new Date().toISOString();
    const rows = [...buckets.values()].map((b) => ({
      fornecedor: b.fornecedor,
      mes: b.mes,
      departamento: b.departamento,
      departamento_tipo: depType.get(b.departamento) ?? null,
      grupo_conta: b.grupo_conta,
      plano_contas: b.plano_contas,
      valor_pago: Math.round(b.valor_pago * 100) / 100,
      titulos: b.titulos.size,
      synced_at: syncedAt,
    }));

    // Troca o período inteiro: pagamento estornado ou reclassificado no SIOE some daqui também.
    const { error: delError } = await orq.from("opex_supplier_payments").delete().gte("mes", periodStart);
    if (delError) throw new Error(`limpar período: ${delError.message}`);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await orq.from("opex_supplier_payments").insert(rows.slice(i, i + 500));
      if (error) throw new Error(`gravar: ${error.message}`);
    }

    const finishedAt = new Date().toISOString();
    if (run) {
      await orq.from("opex_sync_runs").update({ status: "ok", finished_at: finishedAt, rows_written: rows.length }).eq("id", run.id);
    }
    return { periodStart, rows: rows.length, suppliers: new Set(rows.map((r) => r.fornecedor)).size, finishedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run) {
      await orq
        .from("opex_sync_runs")
        .update({ status: "error", finished_at: new Date().toISOString(), error: message.slice(0, 1000) })
        .eq("id", run.id);
    }
    throw new Error(`Falha ao atualizar o OPEX: ${message}`);
  }
}
