/**
 * Sincroniza as tarefas de marketing já consolidadas no SIOE Pro para o
 * ORQESTRAI. Este módulo é exclusivamente server-side.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSioeClient } from "@/lib/sioe-sync-server";

export const VIOS_MARKETING_TASK_LABEL =
  "MATERIAL MARKETING - REELS/POST/ARTIGO";

const PAGE_SIZE = 500;
const READ_BATCH_SIZE = 200;
const WRITE_BATCH_SIZE = 100;
const LEONARDO_NAME = "Leonardo Marques Silva";

export type SyncedViosTaskStatus =
  | "pendente"
  | "em_andamento"
  | "concluido";

export interface SioeViosTaskRow {
  ci: number | string;
  ci_processo: number | string | null;
  area_processo?: string | null;
  tarefa: string | null;
  tarefa_pai: string | null;
  etiqueta_tarefa: string | null;
  status: string | null;
  usuario_conclusao: string | null;
  conclusao_completa: string | null;
  data_conclusao: string | null;
  data_para_conclusao: string | null;
  responsavel: string | null;
  updated_at: string | null;
}

export interface ExistingViosTaskRow {
  vios_id: string;
  ci_processo: string | null;
  area_processo: string | null;
  descricao: string | null;
  comentarios: string | null;
  historico: string | null;
  hora_conclusao: string | null;
  responsaveis: string | null;
  assignee_id: string | null;
  marketing_request_id: string | null;
  raw_data: Record<string, unknown> | null;
  status: SyncedViosTaskStatus;
  data_limite: string | null;
  data_limite_anterior: string | null;
  prorrogada: boolean;
  is_cancelled?: boolean | null;
}

interface ViosUser {
  id: string;
  name: string;
}

export interface ViosSioeSyncResult {
  year: number;
  fetched: number;
  inserted: number;
  updated: number;
  archived: number;
  revived: number;
  missingAssignee: number;
  errors: number;
}

export interface ViosSioeSyncDependencies {
  source?: SupabaseClient;
  target?: SupabaseClient;
  now?: Date;
  year?: number;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function removeLeonardo(value: string | null): string | null {
  if (!value?.trim()) return null;
  const excluded = normalizeName(LEONARDO_NAME);
  const names = value
    .split(/\s*\|\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => normalizeName(name) !== excluded);
  return names.length > 0 ? names.join(" | ") : null;
}

function findUserId(users: ViosUser[], name: string | null): string | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const exact = users.find((user) => normalizeName(user.name) === normalized);
  if (exact) return exact.id;

  const prefix = users.find((user) => {
    const candidate = normalizeName(user.name);
    return candidate.startsWith(normalized) || normalized.startsWith(candidate);
  });
  if (prefix) return prefix.id;

  const words = normalized.split(" ").filter(Boolean);
  const wordMatch = users.find((user) => {
    const candidate = normalizeName(user.name);
    return words.every((word) => candidate.includes(word));
  });
  return wordMatch?.id ?? null;
}

export function isSioeViosTaskCancelled(
  sourceStatus: string | null | undefined
): boolean {
  return normalizeName(sourceStatus) === "cancelada";
}

export function mapSioeViosStatus(
  sourceStatus: string | null | undefined
): SyncedViosTaskStatus {
  const status = normalizeName(sourceStatus)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    status === "concluida" ||
    status === "fechada" ||
    status === "finalizada" ||
    status === "concluido"
  ) {
    return "concluido";
  }
  if (
    status === "aberta" ||
    status === "em andamento" ||
    status === "em_andamento" ||
    status === "em execucao"
  ) {
    return "em_andamento";
  }
  return "pendente";
}

function completionTimestamp(row: SioeViosTaskRow): string | null {
  if (row.conclusao_completa) return row.conclusao_completa;
  if (!row.data_conclusao) return null;
  return `${row.data_conclusao}T12:00:00-03:00`;
}

function mergeRawData(
  existing: ExistingViosTaskRow | undefined,
  row: SioeViosTaskRow
): Record<string, unknown> {
  return {
    ...(existing?.raw_data ?? {}),
    sioe: {
      source_table: "sp_tarefas_historico",
      source_status: row.status,
      source_task: row.tarefa,
      source_updated_at: row.updated_at,
    },
  };
}

export function buildSioeViosTaskPayload(
  row: SioeViosTaskRow,
  existing: ExistingViosTaskRow | undefined,
  users: ViosUser[],
  syncedAt: string
) {
  const sourceResponsible = row.responsavel?.trim() || null;
  const filteredResponsible = removeLeonardo(sourceResponsible);
  const hasSourceResponsible = sourceResponsible !== null;
  const responsible = hasSourceResponsible
    ? filteredResponsible
    : (existing?.responsaveis ?? null);
  const firstResponsible =
    responsible?.split(/\s*\|\s*/)[0]?.trim() || null;
  const assigneeId = hasSourceResponsible
    ? findUserId(users, firstResponsible)
    : (existing?.assignee_id ?? null);
  const deadline = row.data_para_conclusao;
  const deadlineChanged = Boolean(
    existing?.data_limite &&
      deadline &&
      existing.data_limite !== deadline
  );
  const cancelled = isSioeViosTaskCancelled(row.status);

  return {
    vios_id: String(row.ci),
    ci_processo:
      row.ci_processo === null ? null : String(row.ci_processo),
    area_processo:
      row.area_processo?.trim() || existing?.area_processo || null,
    tarefa: VIOS_MARKETING_TASK_LABEL,
    etiquetas_tarefa: row.etiqueta_tarefa?.trim() || null,
    descricao: existing?.descricao ?? null,
    comentarios: existing?.comentarios ?? null,
    historico: existing?.historico ?? null,
    data_limite: deadline,
    data_limite_anterior:
      existing?.data_limite_anterior ??
      (deadlineChanged ? existing?.data_limite ?? null : null),
    prorrogada: existing?.prorrogada === true || deadlineChanged,
    data_conclusao: completionTimestamp(row),
    hora_conclusao: existing?.hora_conclusao ?? null,
    responsaveis: responsible,
    assignee_id: assigneeId,
    status: cancelled
      ? (existing?.status ?? "pendente")
      : mapSioeViosStatus(row.status),
    usuario_concluiu: row.usuario_conclusao?.trim() || null,
    marketing_request_id: existing?.marketing_request_id ?? null,
    raw_data: mergeRawData(existing, row),
    imported_at: syncedAt,
    updated_at: syncedAt,
    is_cancelled: cancelled,
    source_status: row.status?.trim() || null,
    source_synced_at: syncedAt,
  };
}

function getOrqestraiAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada."
    );
  }
  return createClient(url, serviceKey);
}

async function fetchSioeViosTasks(
  source: SupabaseClient,
  year: number
): Promise<SioeViosTaskRow[]> {
  const rows: SioeViosTaskRow[] = [];
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  let from = 0;

  while (true) {
    const { data, error } = await source
      .from("sp_tarefas_historico")
      .select(
        "ci, ci_processo, tarefa, tarefa_pai, etiqueta_tarefa, status, usuario_conclusao, conclusao_completa, data_conclusao, data_para_conclusao, responsavel, updated_at"
      )
      .eq("tarefa_pai", VIOS_MARKETING_TASK_LABEL)
      .gte("data_para_conclusao", start)
      .lte("data_para_conclusao", end)
      .order("ci", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao ler tarefas VIOS no SIOE: ${error.message}`);
    }

    const batch = (data ?? []) as SioeViosTaskRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchCurrentTaskAreas(
  source: SupabaseClient,
  year: number
): Promise<{
  byTask: Map<string, string>;
  byProcess: Map<string, string>;
}> {
  const byTask = new Map<string, string>();
  const byProcess = new Map<string, string>();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  let from = 0;

  while (true) {
    const { data, error } = await source
      .from("sp_tarefas")
      .select("ci, ci_processo, area_processo")
      .eq("tarefa_pai", VIOS_MARKETING_TASK_LABEL)
      .gte("data_para_conclusao", start)
      .lte("data_para_conclusao", end)
      .order("ci", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Erro ao ler áreas das tarefas VIOS no SIOE: ${error.message}`
      );
    }

    const batch = (data ?? []) as Array<{
      ci: number | string;
      ci_processo: number | string | null;
      area_processo: string | null;
    }>;
    for (const row of batch) {
      const area = row.area_processo?.trim();
      if (!area) continue;
      byTask.set(String(row.ci), area);
      if (row.ci_processo !== null) {
        byProcess.set(String(row.ci_processo), area);
      }
    }

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { byTask, byProcess };
}

async function fetchExistingTasks(
  target: SupabaseClient,
  viosIds: string[]
): Promise<Map<string, ExistingViosTaskRow>> {
  const result = new Map<string, ExistingViosTaskRow>();

  for (let index = 0; index < viosIds.length; index += READ_BATCH_SIZE) {
    const ids = viosIds.slice(index, index + READ_BATCH_SIZE);
    const { data, error } = await target
      .from("vios_tasks")
      .select(
        "vios_id, ci_processo, area_processo, descricao, comentarios, historico, hora_conclusao, responsaveis, assignee_id, marketing_request_id, raw_data, status, data_limite, data_limite_anterior, prorrogada, is_cancelled"
      )
      .in("vios_id", ids);

    if (error) {
      throw new Error(
        `Erro ao consultar tarefas existentes no ORQESTRAI: ${error.message}`
      );
    }

    for (const row of (data ?? []) as ExistingViosTaskRow[]) {
      result.set(row.vios_id, row);
    }
  }

  return result;
}

async function fetchActiveUsers(target: SupabaseClient): Promise<ViosUser[]> {
  const { data, error } = await target
    .from("users")
    .select("id, name")
    .eq("is_active", true);
  if (error) {
    throw new Error(`Erro ao consultar usuários do ORQESTRAI: ${error.message}`);
  }
  return ((data ?? []) as Array<{ id: string; name: string | null }>)
    .filter((user): user is ViosUser => Boolean(user.name?.trim()))
    .map((user) => ({ id: user.id, name: user.name }));
}

export async function syncViosTasksFromSioe(
  dependencies: ViosSioeSyncDependencies = {}
): Promise<ViosSioeSyncResult> {
  const source = dependencies.source ?? getSioeClient();
  const target = dependencies.target ?? getOrqestraiAdminClient();
  const now = dependencies.now ?? new Date();
  const year = dependencies.year ?? now.getFullYear();
  const syncedAt = now.toISOString();

  const [sourceRows, sourceAreas] = await Promise.all([
    fetchSioeViosTasks(source, year),
    fetchCurrentTaskAreas(source, year),
  ]);
  if (sourceRows.length === 0) {
    throw new Error(
      `Nenhuma tarefa de Marketing encontrada no SIOE para ${year}; sync cancelado.`
    );
  }

  const viosIds = sourceRows.map((row) => String(row.ci));
  const [existing, users] = await Promise.all([
    fetchExistingTasks(target, viosIds),
    fetchActiveUsers(target),
  ]);

  const areaByProcess = new Map(sourceAreas.byProcess);
  for (const current of existing.values()) {
    if (current.ci_processo && current.area_processo) {
      areaByProcess.set(current.ci_processo, current.area_processo);
    }
  }

  let archived = 0;
  let revived = 0;
  let missingAssignee = 0;
  const payloads = sourceRows.map((row) => {
    const current = existing.get(String(row.ci));
    const processId =
      row.ci_processo === null ? null : String(row.ci_processo);
    const enrichedRow = {
      ...row,
      area_processo:
        sourceAreas.byTask.get(String(row.ci)) ??
        (processId ? areaByProcess.get(processId) : undefined) ??
        row.area_processo ??
        null,
    };
    const payload = buildSioeViosTaskPayload(
      enrichedRow,
      current,
      users,
      syncedAt
    );
    if (payload.is_cancelled) archived++;
    if (current?.is_cancelled === true && !payload.is_cancelled) revived++;
    if (!payload.assignee_id && payload.responsaveis) missingAssignee++;
    return payload;
  });

  for (let index = 0; index < payloads.length; index += WRITE_BATCH_SIZE) {
    const batch = payloads.slice(index, index + WRITE_BATCH_SIZE);
    const { error } = await target
      .from("vios_tasks")
      .upsert(batch, { onConflict: "vios_id" });
    if (error) {
      throw new Error(
        `Erro ao gravar tarefas VIOS no ORQESTRAI: ${error.message}`
      );
    }
  }

  return {
    year,
    fetched: sourceRows.length,
    inserted: sourceRows.length - existing.size,
    updated: existing.size,
    archived,
    revived,
    missingAssignee,
    errors: 0,
  };
}
