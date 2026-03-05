import { supabase } from "@/utils/supabase/client";

export type ViosTaskStatus = "pendente" | "em_andamento" | "concluido";

export interface ViosTask {
  id: string;
  vios_id: string;
  ci_processo: string | null;
  area_processo: string | null;
  tarefa: string;
  etiquetas_tarefa: string | null;
  descricao: string | null;
  comentarios: string | null;
  historico: string | null;
  data_limite: string | null;
  data_conclusao: string | null;
  hora_conclusao: string | null;
  responsaveis: string | null;
  assignee_id: string | null;
  status: ViosTaskStatus;
  usuario_concluiu: string | null;
  marketing_request_id: string | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
  assignee_avatar_url?: string | null;
}

const VIOS_TASKS_SELECT =
  "id, vios_id, ci_processo, area_processo, tarefa, etiquetas_tarefa, descricao, comentarios, historico, data_limite, data_conclusao, hora_conclusao, responsaveis, assignee_id, status, usuario_concluiu, marketing_request_id, imported_at, created_at, updated_at";

type ViosTaskRow = ViosTask & {
  users?: { name: string; avatar_url: string | null } | { name: string; avatar_url: string | null }[] | null;
  assignee_id?: unknown;
};

function mapTaskRow(row: ViosTaskRow): ViosTask {
  const { users: usersRaw, ...rest } = row;
  const users = Array.isArray(usersRaw) ? usersRaw[0] : usersRaw;
  const assigneeName: string | null =
    (users && typeof users === "object" && "name" in users && typeof users.name === "string")
      ? users.name
      : null;
  const assigneeAvatar: string | null =
    (users && typeof users === "object" && "avatar_url" in users && (users.avatar_url == null || typeof users.avatar_url === "string"))
      ? (users.avatar_url ?? null)
      : null;
  return {
    ...rest,
    assignee_name: assigneeName,
    assignee_avatar_url: assigneeAvatar,
  };
}

/** Nome do analista de marketing a ser sempre desconsiderado da coluna Responsáveis. */
const NOME_ANALISTA_EXCLUIR = "Leonardo Marques Silva";

/** Normaliza nome para comparação (trim + colapsa espaços internos). */
function normalizeNameForCompare(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const NOME_ANALISTA_NORMALIZED = normalizeNameForCompare(NOME_ANALISTA_EXCLUIR);

/** Remove o nome do analista da lista de responsáveis (pipe-separada). Aceita variações com espaços extras. */
export function filterLeonardoFromResponsaveis(responsaveis: string | null): string | null {
  if (!responsaveis?.trim()) return responsaveis;
  const parts = responsaveis.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((p) => normalizeNameForCompare(p) !== NOME_ANALISTA_NORMALIZED);
  return filtered.length > 0 ? filtered.join(" | ") : null;
}

/** Retorna o primeiro responsável da lista, excluindo o analista. */
function getFirstResponsavelExcludingLeonardo(responsaveis: string | null): string {
  const filtered = filterLeonardoFromResponsaveis(responsaveis);
  return (filtered ?? "").split(/\s*\|\s*/)[0]?.trim() ?? "";
}

/** Verifica se a etiqueta indica PROTOCOLAR (advogado já enviou por e-mail). */
export function isProtocolar(task: ViosTask): boolean {
  const etq = (task.etiquetas_tarefa ?? "").trim().toUpperCase();
  return etq.includes("PROTOCOL");
}

export interface FetchViosTasksParams {
  limit?: number;
  offset?: number;
  status?: string;
  etiqueta?: string;
  area?: string;
  dataFrom?: string;
  dataTo?: string;
  assigneeId?: string;
  jaNoPlanner?: boolean;
  orderBy?: "data_limite_asc" | "data_limite_desc" | "data_conclusao_desc" | "area";
}

export interface FetchViosTasksResult {
  tasks: ViosTask[];
  total: number;
}

const PAGE_SIZE = 50;

/**
 * Busca tarefas VIOS com uma única query (join em users para nome do assignee).
 * Paginação e filtros opcionais para evitar travar com muitos registros.
 */
export async function fetchViosTasks(
  params: FetchViosTasksParams = {}
): Promise<FetchViosTasksResult> {
  const {
    limit = PAGE_SIZE,
    offset = 0,
    status,
    etiqueta,
    area,
    dataFrom,
    dataTo,
    assigneeId,
    jaNoPlanner,
    orderBy = "data_limite_asc",
  } = params;

  let query = supabase
    .from("vios_tasks")
    .select(`${VIOS_TASKS_SELECT}, users(name, avatar_url)`, { count: "exact" })
    .range(offset, offset + limit - 1);

  if (status && status !== "") {
    query = query.eq("status", status);
  }
  if (etiqueta && etiqueta !== "") {
    query = query.eq("etiquetas_tarefa", etiqueta);
  }
  if (area && area !== "") {
    query = query.eq("area_processo", area);
  }
  if (dataFrom && dataFrom !== "") {
    query = query.gte("data_limite", dataFrom);
  }
  if (dataTo && dataTo !== "") {
    query = query.lte("data_limite", dataTo);
  }
  if (assigneeId && assigneeId !== "") {
    query = query.eq("assignee_id", assigneeId);
  }
  if (jaNoPlanner === true) {
    query = query.not("marketing_request_id", "is", null);
  } else if (jaNoPlanner === false) {
    query = query.is("marketing_request_id", null);
  }

  switch (orderBy) {
    case "data_limite_desc":
      query = query.order("data_limite", { ascending: false, nullsFirst: true });
      break;
    case "data_conclusao_desc":
      query = query.order("data_conclusao", { ascending: false, nullsFirst: true });
      break;
    case "area":
      query = query.order("area_processo", { ascending: true, nullsFirst: true });
      break;
    default:
      query = query.order("data_limite", { ascending: true, nullsFirst: false });
  }
  query = query.order("imported_at", { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    const msg = error?.message ?? JSON.stringify(error);
    console.error("Erro ao buscar tarefas VIOS:", msg);
    return { tasks: [], total: 0 };
  }

  const rows = (data ?? []) as unknown as ViosTaskRow[];
  const tasks = rows.map(mapTaskRow);
  return { tasks, total: count ?? tasks.length };
}

/**
 * Busca a tarefa VIOS vinculada a uma solicitação do Planner (marketing_request_id = requestId).
 * Usado para exibir a seção "Origem VIOS" no detalhe da solicitação.
 */
export async function fetchViosTaskByMarketingRequestId(
  requestId: string
): Promise<ViosTask | null> {
  const { data, error } = await supabase
    .from("vios_tasks")
    .select(VIOS_TASKS_SELECT)
    .eq("marketing_request_id", requestId)
    .maybeSingle();

  if (error || !data) return null;
  return mapTaskRow(data as unknown as ViosTaskRow);
}

/**
 * Lista etiquetas distintas para os filtros (query leve).
 */
export async function fetchViosTaskEtiquetas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("vios_tasks")
    .select("etiquetas_tarefa")
    .not("etiquetas_tarefa", "is", null);

  if (error) {
    console.error("Erro ao buscar etiquetas VIOS:", error);
    return [];
  }

  const set = new Set<string>();
  (data ?? []).forEach((r: { etiquetas_tarefa: string | null }) => {
    if (r.etiquetas_tarefa?.trim()) set.add(r.etiquetas_tarefa.trim());
  });
  return Array.from(set).sort();
}

/**
 * Lista áreas distintas para os filtros.
 */
export async function fetchViosTaskAreas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("vios_tasks")
    .select("area_processo")
    .not("area_processo", "is", null);

  if (error) {
    console.error("Erro ao buscar áreas VIOS:", error);
    return [];
  }

  const set = new Set<string>();
  (data ?? []).forEach((r: { area_processo: string | null }) => {
    if (r.area_processo?.trim()) set.add(r.area_processo.trim());
  });
  return Array.from(set).sort();
}

export async function updateViosTaskAssignee(
  viosId: string,
  userId: string | null
): Promise<{ error: string | null }> {
  const payload: { assignee_id: string | null; updated_at: string } = {
    assignee_id: userId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("vios_tasks")
    .update(payload)
    .eq("vios_id", viosId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function updateViosTaskResponsaveis(
  viosId: string,
  responsaveis: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("vios_tasks")
    .update({
      responsaveis: responsaveis.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("vios_id", viosId);

  if (error) return { error: error.message };
  return { error: null };
}

function normalizeArea(area: string | null): string {
  const a = (area ?? "").trim();
  const map: Record<string, string> = {
    "Special Situations": "Distressed Deals - Special Situations",
    Civel: "Cível",
    "Área Cível": "Cível",
    "Área Trabalhista": "Trabalhista",
    "Área Controladoria": "Operações Legais",
  };
  return map[a] || a || "Outros";
}

/**
 * Promove uma tarefa VIOS concluída para o Planner (cria marketing_request e vincula).
 * Só deve ser chamado pelo gatilho manual na aba Tarefas VIOS.
 */
export async function promoteViosTaskToPlanner(
  viosId: string
): Promise<{ error: string | null; requestId?: string }> {
  const { data: task, error: taskErr } = await supabase
    .from("vios_tasks")
    .select(
      "vios_id, status, marketing_request_id, area_processo, assignee_id, responsaveis, etiquetas_tarefa, descricao, historico, data_conclusao, data_limite"
    )
    .eq("vios_id", viosId)
    .single();

  if (taskErr || !task) return { error: "Tarefa não encontrada" };
  if (task.marketing_request_id) return { error: "Tarefa já foi enviada ao Planner" };

  const area = normalizeArea(task.area_processo);
  const firstResponsavel = getFirstResponsavelExcludingLeonardo(task.responsaveis);
  const { data: users } = await supabase.from("users").select("id, name");
  const userList = users ?? [];
  const solicitanteId =
    task.assignee_id ||
    userList.find((u) =>
      firstResponsavel
        .toLowerCase()
        .split(/\s+/)
        .every((w: string) => (u.name ?? "").toLowerCase().includes(w))
    )?.id;
  const solicitanteName =
    (userList.find((u) => u.id === solicitanteId)?.name ?? firstResponsavel) || "VIOS";

  const title = `VIOS: ${task.etiquetas_tarefa || "REELS/POST/ARTIGO"} - CI ${task.vios_id}`;
  const description = [task.descricao, task.historico].filter(Boolean).join("\n\n") || null;

  const { data: inserted, error: insertErr } = await supabase
    .from("marketing_requests")
    .insert({
      title,
      description,
      requesting_area: area,
      status: "pending",
      workflow_stage: "tarefas",
      request_type: "Post Redes Sociais",
      solicitante: solicitanteName,
      solicitante_id: solicitanteId ?? null,
      requested_at: task.data_conclusao ?? new Date().toISOString(),
      priority: "normal",
      deadline: task.data_limite ?? null,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };

  const { error: updateErr } = await supabase
    .from("vios_tasks")
    .update({
      marketing_request_id: inserted.id,
      updated_at: new Date().toISOString(),
    })
    .eq("vios_id", viosId);

  if (updateErr) return { error: updateErr.message };
  return { error: null, requestId: inserted.id };
}

export interface ViosToPlannerFormData {
  title: string;
  request_type: string;
  solicitante_id: string | null;
  solicitante: string | null;
  requesting_area: string;
  description: string;
  link?: string | null;
  referencias?: string | null;
  assignee_id: string | null;
  priority: string;
  deadline: string | null;
  deadline_time: string | null;
}

/**
 * Cria marketing_request a partir dos dados do formulário (informações do e-mail)
 * e vincula à tarefa VIOS.
 */
export async function promoteViosTaskToPlannerWithForm(
  viosId: string,
  formData: ViosToPlannerFormData,
  createdBy: { id: string | null; name: string | null }
): Promise<{ error: string | null; requestId?: string }> {
  const { data: task, error: taskErr } = await supabase
    .from("vios_tasks")
    .select("vios_id, marketing_request_id, data_conclusao")
    .eq("vios_id", viosId)
    .single();

  if (taskErr || !task) return { error: "Tarefa não encontrada" };
  if (task.marketing_request_id) return { error: "Tarefa já foi enviada ao Planner" };

  const area = normalizeArea(formData.requesting_area);
  const user = formData.solicitante_id
    ? (await supabase.from("users").select("name, department").eq("id", formData.solicitante_id).single()).data
    : null;
  const solicitanteName = user?.name ?? formData.solicitante ?? "VIOS";
  const requestingArea = user?.department ?? area;

  const designer = formData.assignee_id
    ? (await supabase.from("users").select("name").eq("id", formData.assignee_id).single()).data
    : null;

  const { data: inserted, error: insertErr } = await supabase
    .from("marketing_requests")
    .insert({
      title: formData.title.trim() || `VIOS - CI ${viosId}`,
      description: formData.description.trim() || null,
      requesting_area: requestingArea,
      status: "pending",
      workflow_stage: "tarefas",
      request_type: formData.request_type || "Post Redes Sociais",
      solicitante: solicitanteName,
      solicitante_id: formData.solicitante_id || null,
      requested_at: task.data_conclusao ?? new Date().toISOString(),
      priority: formData.priority || "normal",
      deadline: formData.deadline || null,
      deadline_time: formData.deadline_time || null,
      assignee: designer?.name ?? null,
      assignee_id: formData.assignee_id || null,
      link: formData.link || null,
      referencias: formData.referencias || null,
      created_by_id: createdBy.id,
      created_by: createdBy.name,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };

  const { error: updateErr } = await supabase
    .from("vios_tasks")
    .update({
      marketing_request_id: inserted.id,
      updated_at: new Date().toISOString(),
    })
    .eq("vios_id", viosId);

  if (updateErr) return { error: updateErr.message };
  return { error: null, requestId: inserted.id };
}
