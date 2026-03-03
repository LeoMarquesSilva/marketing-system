import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";
import { differenceInDays } from "date-fns";

import type { WorkflowStage, CompletionType } from "@/lib/constants";

export type UserRole = "admin" | "designer" | "solicitante";

export type MarketingRequestStatus = "pending" | "in_progress" | "completed";

export type RequestPriority = "urgente" | "alta" | "normal" | "baixa";

export interface MarketingRequest {
  id: string;
  title: string;
  description: string | null;
  requesting_area: string;
  status: MarketingRequestStatus;
  requested_at: string;
  delivered_at: string | null;
  assignee: string | null;
  assignee_id: string | null;
  solicitante: string | null;
  solicitante_id: string | null;
  request_type: string | null;
  link: string | null;
  referencias: string | null;
  nome_advogado: string | null;
  workflow_stage: WorkflowStage | null;
  completion_type: CompletionType | null;
  priority: RequestPriority;
  deadline: string | null;
  stage_changed_at: string | null;
  art_link: string | null;
  solicitante_user?: { name: string; department: string; avatar_url: string | null } | null;
  assignee_user?: { name: string; avatar_url: string | null } | null;
}

export interface FetchMarketingRequestsOptions {
  userId?: string;
  role?: UserRole;
  supabaseClient?: SupabaseClient;
}

// Colunas necessárias para o Kanban + cards de concluídos (inclui link e referências para o modal)
const KANBAN_SELECT =
  "id, title, description, requesting_area, status, requested_at, delivered_at, " +
  "assignee, assignee_id, solicitante, solicitante_id, request_type, " +
  "link, referencias, nome_advogado, art_link, " +
  "workflow_stage, completion_type, priority, deadline, stage_changed_at";

const KANBAN_SELECT_WITHOUT_ART_LINK =
  "id, title, description, requesting_area, status, requested_at, delivered_at, " +
  "assignee, assignee_id, solicitante, solicitante_id, request_type, " +
  "link, referencias, nome_advogado, " +
  "workflow_stage, completion_type, priority, deadline, stage_changed_at";

function logSupabaseError(context: string, err: unknown) {
  const e = err as { message?: string; code?: string; details?: string; hint?: string };
  console.error(
    `${context}:`,
    e?.message ?? String(err),
    e?.code != null ? `[${e.code}]` : "",
    e?.details ? `| ${e.details}` : "",
    e?.hint ? `| ${e.hint}` : ""
  );
}

export async function fetchMarketingRequests(
  options?: FetchMarketingRequestsOptions
): Promise<MarketingRequest[]> {
  const client = options?.supabaseClient ?? supabase;
  let query = client
    .from("marketing_requests")
    .select(KANBAN_SELECT)
    .order("requested_at", { ascending: false });

  if (options?.userId && options?.role && options.role !== "admin") {
    if (options.role === "designer") {
      query = query.eq("assignee_id", options.userId);
    } else if (options.role === "solicitante") {
      query = query.eq("solicitante_id", options.userId);
    }
  }

  let { data, error } = await query;

  if (error) {
    logSupabaseError("Erro ao buscar solicitações", error);
    const msg = String((error as { message?: string }).message ?? "");
    if (msg.includes("art_link") && msg.toLowerCase().includes("does not exist")) {
      query = client
        .from("marketing_requests")
        .select(KANBAN_SELECT_WITHOUT_ART_LINK)
        .order("requested_at", { ascending: false });
      if (options?.userId && options?.role && options.role !== "admin") {
        if (options.role === "designer") query = query.eq("assignee_id", options.userId!);
        else if (options.role === "solicitante") query = query.eq("solicitante_id", options.userId!);
      }
      const fallback = await query;
      if (fallback.error) {
        logSupabaseError("Erro ao buscar solicitações (fallback sem art_link)", fallback.error);
        return [];
      }
      data = fallback.data;
      error = null;
    } else {
      return [];
    }
  }

  let requests = (data ?? []) as unknown as MarketingRequest[];
  if (error === null && data && requests.length > 0 && (requests[0] as unknown as Record<string, unknown>).art_link === undefined) {
    requests = requests.map((r) => ({ ...r, art_link: null })) as MarketingRequest[];
  }

  // Designer: filtro extra para garantir que tarefas sem assignee nunca apareçam
  if (options?.role === "designer" && options?.userId) {
    requests = requests.filter((r) => r.assignee_id === options.userId);
  }
  const ids = [
    ...new Set(
      requests.flatMap((r) => [r.solicitante_id, r.assignee_id].filter(Boolean))
    ),
  ] as string[];

  let usersMap: Record<
    string,
    { name: string; department: string; avatar_url: string | null }
  > = {};
  if (ids.length > 0) {
    // usa o mesmo client (server-side) para respeitar o contexto de RLS
    const { data: users } = await client
      .from("users")
      .select("id, name, department, avatar_url")
      .in("id", ids);
    usersMap = (users ?? []).reduce(
      (acc, u) => {
        acc[u.id] = { name: u.name, department: u.department, avatar_url: u.avatar_url };
        return acc;
      },
      {} as Record<string, { name: string; department: string; avatar_url: string | null }>
    );
  }

  return requests.map((r) => ({
    ...r,
    solicitante_user: r.solicitante_id ? usersMap[r.solicitante_id] ?? null : null,
    assignee_user:
      r.assignee_id && usersMap[r.assignee_id]
        ? { name: usersMap[r.assignee_id].name, avatar_url: usersMap[r.assignee_id].avatar_url }
        : null,
  }));
}

const UNLINKED_SELECT =
  "id, solicitante, request_type, title, requesting_area, description, requested_at";

export async function fetchUnlinkedRequests(): Promise<MarketingRequest[]> {
  const { data, error } = await supabase
    .from("marketing_requests")
    .select(UNLINKED_SELECT)
    .is("solicitante_id", null)
    .not("solicitante", "is", null)
    .order("requested_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar solicitações não vinculadas:", error);
    return [];
  }
  return (data ?? []) as unknown as MarketingRequest[];
}

export async function linkSolicitante(
  requestId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { data: user } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .single();

  if (!user) return { error: "Usuário não encontrado" };

  const { error } = await supabase
    .from("marketing_requests")
    .update({ solicitante_id: userId, solicitante: user.name })
    .eq("id", requestId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function linkSolicitantesBatch(
  requestIds: string[],
  userId: string
): Promise<{ linked: number; error: string | null }> {
  if (requestIds.length === 0) return { linked: 0, error: null };

  const { data: user } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .single();

  if (!user) return { linked: 0, error: "Usuário não encontrado" };

  const { error } = await supabase
    .from("marketing_requests")
    .update({ solicitante_id: userId, solicitante: user.name })
    .in("id", requestIds);

  if (error) return { linked: 0, error: error.message };
  return { linked: requestIds.length, error: null };
}

export interface UpdateRequestInput {
  title?: string;
  request_type?: string;
  description?: string | null;
  requesting_area?: string;
  status?: MarketingRequestStatus;
  assignee?: string | null;
  assignee_id?: string | null;
  solicitante?: string | null;
  solicitante_id?: string | null;
  requested_at?: string;
  delivered_at?: string | null;
  link?: string | null;
  referencias?: string | null;
  nome_advogado?: string | null;
  workflow_stage?: WorkflowStage | null;
  completion_type?: CompletionType | null;
  priority?: RequestPriority;
  deadline?: string | null;
  art_link?: string | null;
}

export async function updateMarketingRequest(
  id: string,
  input: UpdateRequestInput
): Promise<{ data: MarketingRequest | null; error: string | null }> {
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.request_type !== undefined) updates.request_type = input.request_type;
  if (input.description !== undefined) updates.description = input.description;
  if (input.requesting_area !== undefined) updates.requesting_area = input.requesting_area;
  if (input.status !== undefined) updates.status = input.status;
  if (input.assignee !== undefined) updates.assignee = input.assignee;
  if (input.assignee_id !== undefined) updates.assignee_id = input.assignee_id;
  if (input.solicitante !== undefined) updates.solicitante = input.solicitante;
  if (input.solicitante_id !== undefined) updates.solicitante_id = input.solicitante_id;
  if (input.requested_at !== undefined) updates.requested_at = input.requested_at;
  if (input.delivered_at !== undefined) updates.delivered_at = input.delivered_at;
  if (input.link !== undefined) updates.link = input.link;
  if (input.referencias !== undefined) updates.referencias = input.referencias;
  if (input.nome_advogado !== undefined) updates.nome_advogado = input.nome_advogado;
  if (input.workflow_stage !== undefined) updates.workflow_stage = input.workflow_stage;
  if (input.completion_type !== undefined) updates.completion_type = input.completion_type;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.deadline !== undefined) updates.deadline = input.deadline;
  if (input.art_link !== undefined) updates.art_link = input.art_link;

  const { data, error } = await supabase
    .from("marketing_requests")
    .update(updates)
    .eq("id", id)
    .select(KANBAN_SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as MarketingRequest, error: null };
}

export async function deleteMarketingRequest(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("marketing_requests").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateWorkflowStage(
  id: string,
  workflow_stage: WorkflowStage
): Promise<{ data: MarketingRequest | null; error: string | null }> {
  return updateMarketingRequest(id, { workflow_stage });
}

export function computeDashboardMetrics(requests: MarketingRequest[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const total = requests.length;

  const thisMonth = requests.filter((r) => {
    const d = new Date(r.requested_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const completedWithDelivery = requests.filter(
    (r) => r.status === "completed" && r.delivered_at
  );

  const avgDays =
    completedWithDelivery.length > 0
      ? completedWithDelivery.reduce((acc, r) => {
          return (
            acc +
            differenceInDays(
              new Date(r.delivered_at!),
              new Date(r.requested_at)
            )
          );
        }, 0) / completedWithDelivery.length
      : null;

  const completedCount = requests.filter((r) => r.status === "completed").length;
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = requests.filter(
    (r) => r.status !== "completed" && r.deadline && new Date(r.deadline) < today
  ).length;
  const unassignedCount = requests.filter(
    (r) => r.status !== "completed" && !r.assignee_id
  ).length;

  const areaCounts = requests.reduce(
    (acc, r) => {
      const area = r.requesting_area || "Outros";
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const dataByArea = Object.entries(areaCounts)
    .map(([area, total]) => ({ area, total }))
    .sort((a, b) => b.total - a.total);

  const typeCounts = requests.reduce(
    (acc, r) => {
      const type = r.request_type || r.title || "Outros";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const dataByType = Object.entries(typeCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const statusCounts = requests.reduce(
    (acc, r) => {
      const label =
        r.status === "pending"
          ? "Pendente"
          : r.status === "in_progress"
            ? "Em andamento"
            : "Concluído";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const dataByStatus = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    total,
    totalThisMonth: thisMonth.length,
    avgDeliveryDays: avgDays,
    completedCount,
    pendingCount,
    inProgressCount,
    overdueCount,
    unassignedCount,
    dataByArea,
    dataByType,
    dataByStatus,
  };
}
