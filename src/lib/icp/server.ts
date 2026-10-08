import "server-only";

import { unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSioeClient } from "@/lib/sioe-sync-server";
import { onlyCnpjDigits } from "@/lib/icp/cnpj";
import { loadCnpjRecords } from "@/lib/icp/cnpj-server";
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

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Versão paralela do fetchAll para tabelas grandes (o timesheet passa de 150 mil linhas
 * em 12 meses): conta as linhas e lê as páginas em lotes. A consulta precisa de ordem estável.
 */
async function fetchAllParallel<T>(
  count: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  build: (from: number, to: number) => PageResult<T>,
  concurrency = 8
): Promise<T[]> {
  const head = await count();
  if (head.error) throw new Error(head.error.message);
  const pages = Math.ceil((head.count ?? 0) / PAGE_SIZE);
  const rows: T[] = [];
  let lastPageFull = pages === 0;
  for (let start = 0; start < pages; start += concurrency) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(concurrency, pages - start) }, (_, i) => {
        const from = (start + i) * PAGE_SIZE;
        return build(from, from + PAGE_SIZE - 1);
      })
    );
    for (const { data, error } of batch) {
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      lastPageFull = (data?.length ?? 0) === PAGE_SIZE;
    }
  }
  // Linhas inseridas depois da contagem.
  if (lastPageFull) {
    const extra = await fetchAll<T>((from, to) => build(pages * PAGE_SIZE + from, pages * PAGE_SIZE + to));
    rows.push(...extra);
  }
  return rows;
}

/**
 * Grupos de conta do financeiro que formam o custo de pessoal das áreas (remuneração
 * fixa e variável, encargos e benefícios). O VIOS grava alguns com acentuação quebrada,
 * por isso o filtro usa prefixos.
 */
const PERSONNEL_COST_FILTER = "grupo_conta.ilike.REMUNERA*,grupo_conta.ilike.ENCARGOS SOCIAIS*,grupo_conta.ilike.BENEF*";

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
  const today = now.toISOString().slice(0, 10);
  const sioe = getSioeClient();
  const main = getMainClient();

  const [
    groupMap,
    revenueRows,
    processRows,
    pessoaRows,
    overdueRows,
    timesheetRows,
    personnelRows,
    npsRows,
    insightRows,
    linkedinLatest,
    ga4Rows,
    whatsappRows,
    cnpjRecords,
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
      cpf_cnpj: string | null;
      nome: string | null;
    }>((from, to) =>
      sioe
        .from("pessoas")
        .select("id, grupo_cliente, tipo, uf, cidade, categoria, cpf_cnpj, nome")
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ id: string; cliente: string | null; departamento: string | null; valor_parcial_aberto: number | string | null }>(
      (from, to) =>
        sioe
          .from("financeiro_parcelas_itens")
          .select("id, cliente, departamento, valor_parcial_aberto")
          .eq("tipo", "RECEBER")
          .ilike("plano_contas", "HONOR%")
          .gt("valor_parcial_aberto", 0)
          .lt("data_vencimento", today)
          .order("id")
          .range(from, to)
    ),
    fetchAllParallel<{ grupo_cliente: string | null; area: string | null; total_horas_decimal: number | string | null }>(
      () => sioe.from("timesheets").select("id", { count: "exact", head: true }).gte("data", since),
      (from, to) =>
        sioe
          .from("timesheets")
          .select("grupo_cliente, area, total_horas_decimal")
          .gte("data", since)
          .order("id")
          .range(from, to)
    ),
    fetchAll<{ id: string; departamento: string | null; valor_pago_item: number | string | null }>((from, to) =>
      sioe
        .from("financeiro_parcelas_itens")
        .select("id, departamento, valor_pago_item")
        .eq("tipo", "PAGAR")
        .or(PERSONNEL_COST_FILTER)
        .gt("valor_pago_item", 0)
        .gte("data_pagamento", since)
        .order("id")
        .range(from, to)
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
    loadCnpjRecords(main),
  ]);

  const recordByCnpj = new Map(cnpjRecords.map((r) => [r.cnpj, r]));

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
  const groupOf = (cliente: string) => {
    const name = cliente.trim();
    return nameToGroup.get(name.toLowerCase()) ?? name;
  };

  // Só conta como cliente quem está num grupo de cliente ou cadastrado como cliente no
  // VIOS. Pagamentos da parte contrária, de fornecedores ou de quem não tem cadastro
  // (em geral sucumbência e êxito) ficam fora do ICP.
  const clientNames = new Set(
    pessoaRows.filter((p) => /cliente/i.test(p.categoria ?? "")).map((p) => (p.nome ?? "").trim().toLowerCase())
  );
  const isClientPayer = (cliente: string) => {
    const name = cliente.trim().toLowerCase();
    return nameToGroup.has(name) || clientNames.has(name);
  };
  const excludedPayers = new Map<string, number>();
  const revenue: IcpRevenueItem[] = revenueRows
    .filter((r) => r.cliente && r.data_pagamento)
    .filter((r) => {
      if (isClientPayer(r.cliente!)) return true;
      const name = r.cliente!.trim();
      excludedPayers.set(name, (excludedPayers.get(name) ?? 0) + toNumber(r.valor_pago_item));
      return false;
    })
    .map((r) => {
      return {
        grupo: groupOf(r.cliente!),
        departamento: r.departamento,
        planoContas: r.plano_contas,
        valor: toNumber(r.valor_pago_item),
        dataPagamento: r.data_pagamento!,
      };
    });

  // Cliente sem grupo no VIOS: a receita fica no nome do cliente, então a pessoa com o
  // mesmo nome entra como o próprio "grupo" (para pegar cidade e CNPJ dela).
  const revenueKeyByName = new Map(revenue.map((r) => [r.grupo.toLowerCase(), r.grupo]));
  const pessoaGroup = (p: { grupo_cliente: string | null; nome: string | null }) =>
    (p.grupo_cliente ?? "").trim() || revenueKeyByName.get((p.nome ?? "").trim().toLowerCase()) || null;

  // O timesheet tem mais de 150 mil linhas: soma por grupo e área antes do cálculo.
  const hoursByKey = new Map<string, { grupo: string; area: string | null; horas: number }>();
  for (const t of timesheetRows) {
    const grupo = (t.grupo_cliente ?? "").trim();
    const key = `${grupo}\u0000${t.area ?? ""}`;
    const entry = hoursByKey.get(key) ?? { grupo, area: t.area, horas: 0 };
    entry.horas += toNumber(t.total_horas_decimal);
    hoursByKey.set(key, entry);
  }

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
    excludedPayers: {
      count: excludedPayers.size,
      revenue: [...excludedPayers.values()].reduce((acc, v) => acc + v, 0),
    },
    processes: processRows.map((p) => ({
      grupo: (p.grupo_cliente ?? "").trim(),
      area: p.area,
      dataCadastro: p.data_cadastro,
    })),
    pessoas: pessoaRows.flatMap((p) => {
      const grupo = pessoaGroup(p);
      return grupo ? [{ grupo, tipo: p.tipo, uf: p.uf, cidade: p.cidade, categoria: p.categoria }] : [];
    }),
    companies: pessoaRows.flatMap((p) => {
      const grupo = pessoaGroup(p);
      const cnpj = onlyCnpjDigits(p.cpf_cnpj);
      const record = grupo && cnpj ? recordByCnpj.get(cnpj) : undefined;
      return record ? [{ grupo: grupo!, categoria: p.categoria, record }] : [];
    }),
    overdue: overdueRows
      .filter((o) => o.cliente && isClientPayer(o.cliente))
      .map((o) => ({
        grupo: groupOf(o.cliente!),
        departamento: o.departamento,
        valor: toNumber(o.valor_parcial_aberto),
      })),
    hours: [...hoursByKey.values()],
    personnelCost: personnelRows.map((p) => ({ departamento: p.departamento, valor: toNumber(p.valor_pago_item) })),
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
export const getIcpData = unstable_cache(loadIcpData, ["icp-data-v8"], {
  revalidate: 60 * 60 * 6,
  tags: [ICP_CACHE_TAG],
});
