import "server-only";

import { unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSioeClient } from "@/lib/sioe-sync-server";
import {
  computeIcp,
  type IcpData,
  type IcpDemographicRow,
  type IcpNpsTheme,
  type IcpRevenueItem,
} from "@/lib/icp/compute";

export const ICP_CACHE_TAG = "icp";

const PAGE_SIZE = 1000;

function getMainClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key);
}

/** Lê todas as páginas de uma consulta (o PostgREST devolve no máximo 1.000 linhas). */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function windowStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

const toNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function loadIcpData(): Promise<IcpData> {
  const now = new Date();
  const since = windowStart(now);
  const sioe = getSioeClient();
  const main = getMainClient();

  const [
    groupMap,
    revenueRows,
    processRows,
    pessoaRows,
    overdueRows,
    contactRows,
    clientGroups,
    npsRows,
    insightRows,
    linkedinLatest,
    ga4Rows,
    whatsappRows,
  ] = await Promise.all([
    fetchAll<{ cliente_norm: string; grupo_cliente: string | null }>((from, to) =>
      sioe.from("receita_grupo_por_nome_cliente").select("cliente_norm, grupo_cliente").range(from, to)
    ),
    fetchAll<{
      id: string;
      cliente: string | null;
      departamento: string | null;
      plano_contas: string | null;
      valor_pago_item: number | string | null;
      data_pagamento: string | null;
    }>((from, to) =>
      sioe
        .from("financeiro_parcelas_itens")
        .select("id, cliente, departamento, plano_contas, valor_pago_item, data_pagamento")
        .eq("tipo", "RECEBER")
        .ilike("plano_contas", "HONOR%")
        .gt("valor_pago_item", 0)
        .gte("data_pagamento", since)
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ id: string; grupo_cliente: string | null; area: string | null; data_cadastro: string | null }>(
      (from, to) =>
        sioe
          .from("processos_completo")
          .select("id, grupo_cliente, area, data_cadastro")
          .not("grupo_cliente", "is", null)
          .not("data_cadastro", "is", null)
          .order("id")
          .range(from, to)
    ),
    fetchAll<{
      id: string;
      grupo_cliente: string | null;
      tipo: string | null;
      uf: string | null;
      cidade: string | null;
      categoria: string | null;
    }>((from, to) =>
      sioe
        .from("pessoas")
        .select("id, grupo_cliente, tipo, uf, cidade, categoria")
        .not("grupo_cliente", "is", null)
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ grupo_cliente: string | null; valor_em_atraso: number | string | null }>((from, to) =>
      sioe.from("escritorio_grupos_resumo").select("grupo_cliente, valor_em_atraso").range(from, to)
    ),
    fetchAll<{ id: string; client_group_id: string | null; custom_fields: Record<string, unknown> | null }>(
      (from, to) =>
        main.from("email_contacts").select("id, client_group_id, custom_fields").order("id").range(from, to)
    ),
    fetchAll<{ id: string; name: string }>((from, to) =>
      main.from("email_client_groups").select("id, name").order("id").range(from, to)
    ),
    fetchAll<{ id: string; respondent_cargo: string | null; score_recommend: number | null }>((from, to) =>
      main.from("nps_responses").select("id, respondent_cargo, score_recommend").order("id").range(from, to)
    ),
    fetchAll<{ id: string; themes: unknown; is_noise: boolean | null }>((from, to) =>
      main.from("nps_response_insights").select("id, themes, is_noise").order("id").range(from, to)
    ),
    main
      .from("linkedin_demographic_snapshots")
      .select("captured_at")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchAll<{ id: string; city: string | null; sessions: number | null }>((from, to) =>
      main
        .from("ga4_location_daily_metrics")
        .select("id, city, sessions")
        .gte("metric_date", since)
        .ilike("country", "Brazil%")
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ id: string; lead_source: string | null; pipeline_stage: string | null; is_group: boolean | null }>(
      (from, to) =>
        main
          .from("whatsapp_conversations")
          .select("id, lead_source, pipeline_stage, is_group")
          .order("id")
          .range(from, to)
    ),
  ]);

  let linkedin: IcpDemographicRow[] = [];
  const latestCapture = (linkedinLatest.data as { captured_at: string } | null)?.captured_at;
  if (latestCapture) {
    const rows = await fetchAll<{
      id: string;
      report_type: string;
      dimension: string;
      label: string;
      metric_value: number | null;
    }>((from, to) =>
      main
        .from("linkedin_demographic_snapshots")
        .select("id, report_type, dimension, label, metric_value")
        .eq("captured_at", latestCapture)
        .order("id")
        .range(from, to)
    );
    linkedin = rows.map((r) => ({
      reportType: r.report_type,
      dimension: r.dimension,
      label: r.label,
      value: toNumber(r.metric_value),
    }));
  }

  const nameToGroup = new Map(
    groupMap.filter((m) => m.grupo_cliente).map((m) => [m.cliente_norm, m.grupo_cliente!.trim()])
  );
  const revenue: IcpRevenueItem[] = revenueRows
    .filter((r) => r.cliente && r.data_pagamento)
    .map((r) => {
      const cliente = r.cliente!.trim();
      return {
        grupo: nameToGroup.get(cliente.toLowerCase()) ?? cliente,
        departamento: r.departamento,
        planoContas: r.plano_contas,
        valor: toNumber(r.valor_pago_item),
        dataPagamento: r.data_pagamento!,
      };
    });

  const groupNames = new Map(clientGroups.map((g) => [g.id, g.name]));
  const sectors = contactRows
    .map((c) => {
      const cf = c.custom_fields ?? {};
      const str = (k: string) => (typeof cf[k] === "string" && (cf[k] as string).trim()) || null;
      const grupo =
        (c.client_group_id && groupNames.get(c.client_group_id)) ||
        str("sioe_grupo_cliente") ||
        str("rd_grupo_empresa");
      return grupo
        ? { grupo, setor: str("rd_setor_empresa"), colaboradores: str("rd_numero_de_colaboradores") }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s && (s.setor || s.colaboradores)));

  const npsThemes: IcpNpsTheme[] = insightRows
    .filter((r) => !r.is_noise && Array.isArray(r.themes))
    .flatMap((r) => r.themes as { id?: string; polarity?: string }[])
    .filter((t) => t && typeof t.id === "string")
    .map((t) => ({ id: t.id!, polarity: t.polarity ?? "" }));

  const ga4ByCity = new Map<string, number>();
  for (const r of ga4Rows) {
    if (!r.city || r.city === "(not set)") continue;
    ga4ByCity.set(r.city, (ga4ByCity.get(r.city) ?? 0) + toNumber(r.sessions));
  }

  return computeIcp({
    now,
    revenue,
    processes: processRows.map((p) => ({
      grupo: (p.grupo_cliente ?? "").trim(),
      area: p.area,
      dataCadastro: p.data_cadastro,
    })),
    pessoas: pessoaRows.map((p) => ({
      grupo: (p.grupo_cliente ?? "").trim(),
      tipo: p.tipo,
      uf: p.uf,
      cidade: p.cidade,
      categoria: p.categoria,
    })),
    overdue: overdueRows
      .filter((o) => o.grupo_cliente)
      .map((o) => ({ grupo: o.grupo_cliente!.trim(), valorEmAtraso: toNumber(o.valor_em_atraso) })),
    sectors,
    nps: npsRows.map((r) => ({ cargo: r.respondent_cargo, recommend: r.score_recommend })),
    npsThemes,
    linkedin,
    ga4Cities: [...ga4ByCity.entries()].map(([city, sessions]) => ({ city, sessions })),
    whatsapp: whatsappRows
      .filter((w) => !w.is_group)
      .map((w) => ({ leadSource: w.lead_source, pipelineStage: w.pipeline_stage })),
  });
}

/** Resultado em cache por 6 horas; o botão "Recalcular" invalida a tag. */
export const getIcpData = unstable_cache(loadIcpData, ["icp-data-v1"], {
  revalidate: 60 * 60 * 6,
  tags: [ICP_CACHE_TAG],
});
