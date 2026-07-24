import { differenceInCalendarDays } from "date-fns";
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
  /** Prazo anterior à prorrogação (quando detectado). */
  data_limite_anterior: string | null;
  /** Tarefa teve prazo prorrogado no VIOS. */
  prorrogada: boolean;
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
  /** Tarefa pareada (PROTOCOLO ↔ REVISAR) no mesmo ci_processo. */
  paired_task?: ViosTask | null;
}

export type ViosEntregaSituacao =
  | "aguardando"
  | "atrasada"
  | "no_prazo"
  | "entregue_atrasada"
  | "sem_prazo";

export interface ViosTaskStats {
  total: number;
  aguardando: number;
  atrasadas: number;
  concluidasNoPrazo: number;
  concluidasAtrasadas: number;
  prontasPlanner: number;
  noPlanner: number;
}

const VIOS_TASKS_SELECT =
  "id, vios_id, ci_processo, area_processo, tarefa, etiquetas_tarefa, descricao, comentarios, historico, data_limite, data_limite_anterior, prorrogada, data_conclusao, hora_conclusao, responsaveis, assignee_id, status, usuario_concluiu, marketing_request_id, imported_at, created_at, updated_at";

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
    prorrogada: rest.prorrogada === true,
    assignee_name: assigneeName,
    assignee_avatar_url: assigneeAvatar,
  };
}

function formatViosDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** Texto explicativo quando a tarefa foi prorrogada no VIOS. */
export function formatViosProrrogacaoLabel(
  task: Pick<ViosTask, "data_limite_anterior" | "data_limite">
): string {
  if (task.data_limite_anterior && task.data_limite) {
    return `Prazo prorrogado de ${formatViosDateLabel(task.data_limite_anterior)} para ${formatViosDateLabel(task.data_limite)}`;
  }
  return "Prazo prorrogado no VIOS";
}

export function isViosTaskProrrogada(task: Pick<ViosTask, "prorrogada">): boolean {
  return task.prorrogada === true;
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

export type InactiveCollaboratorIndex = {
  users: { id: string; name: string }[];
};

let inactiveCollaboratorCache: { index: InactiveCollaboratorIndex; at: number } | null = null;

async function fetchInactiveCollaboratorIndex(): Promise<InactiveCollaboratorIndex> {
  if (inactiveCollaboratorCache && Date.now() - inactiveCollaboratorCache.at < 60_000) {
    return inactiveCollaboratorCache.index;
  }
  const { data } = await supabase.from("users").select("id, name").eq("is_active", false);
  const index: InactiveCollaboratorIndex = {
    users: (data ?? []).map((u) => ({ id: u.id, name: u.name ?? "" })),
  };
  inactiveCollaboratorCache = { index, at: Date.now() };
  return index;
}

function nameMatchesInactiveUser(name: string, inactiveUsers: InactiveCollaboratorIndex["users"]): boolean {
  const s = normalizeNameForCompare(name);
  if (!s) return false;
  const words = s.split(" ").filter(Boolean);
  for (const u of inactiveUsers) {
    const un = normalizeNameForCompare(u.name);
    if (un === s) return true;
    if (un.startsWith(s) || s.startsWith(un)) return true;
    if (words.length > 0 && words.every((w) => un.includes(w))) return true;
  }
  return false;
}

/** Tarefa cujo colaborador principal (assignee ou responsável) está inativo. */
export function isInactiveCollaboratorTask(
  task: Pick<ViosTask, "assignee_id" | "responsaveis">,
  inactive: InactiveCollaboratorIndex
): boolean {
  if (inactive.users.length === 0) return false;
  if (task.assignee_id && inactive.users.some((u) => u.id === task.assignee_id)) return true;
  const parts = (filterLeonardoFromResponsaveis(task.responsaveis) ?? "")
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.some((part) => nameMatchesInactiveUser(part, inactive.users));
}

function filterActiveCollaboratorTasks<T extends Pick<ViosTask, "assignee_id" | "responsaveis">>(
  tasks: T[],
  inactive: InactiveCollaboratorIndex
): T[] {
  if (inactive.users.length === 0) return tasks;
  return tasks.filter((t) => !isInactiveCollaboratorTask(t, inactive));
}

function sortByDataLimite(a: ViosTask, b: ViosTask): number {
  return (a.data_limite ?? "").localeCompare(b.data_limite ?? "");
}

/** Score de pareamento: 0 = PROTOCOLO 1 dia após REVISAR (ideal no VIOS). */
export function viosPairingScore(a: ViosTask, b: ViosTask): number {
  const revisar = a.etiquetas_tarefa === "REVISAR" ? a : b.etiquetas_tarefa === "REVISAR" ? b : null;
  const protocolo = a.etiquetas_tarefa === "PROTOCOLO" ? a : b.etiquetas_tarefa === "PROTOCOLO" ? b : null;
  if (!revisar || !protocolo) return 9999;
  if (!revisar.data_limite || !protocolo.data_limite) {
    const idA = parseInt(revisar.vios_id, 10);
    const idB = parseInt(protocolo.vios_id, 10);
    if (!Number.isNaN(idA) && !Number.isNaN(idB)) return 1000 + Math.abs(idA - idB);
    return 9999;
  }
  const diff = differenceInCalendarDays(
    new Date(protocolo.data_limite + "T12:00:00"),
    new Date(revisar.data_limite + "T12:00:00")
  );
  return Math.abs(diff - 1);
}

const MAX_PAIRING_SCORE = 7;

/** Mapa vios_id → vios_id da tarefa pareada. */
export function buildViosPairMap(tasks: ViosTask[]): Map<string, string> {
  const byProcess = new Map<string, ViosTask[]>();
  for (const t of tasks) {
    if (!t.ci_processo) continue;
    if (t.etiquetas_tarefa !== "PROTOCOLO" && t.etiquetas_tarefa !== "REVISAR") continue;
    const list = byProcess.get(t.ci_processo) ?? [];
    list.push(t);
    byProcess.set(t.ci_processo, list);
  }

  const pairMap = new Map<string, string>();
  for (const processTasks of byProcess.values()) {
    const revisarList = processTasks
      .filter((t) => t.etiquetas_tarefa === "REVISAR")
      .sort(sortByDataLimite);
    const protocoloList = processTasks
      .filter((t) => t.etiquetas_tarefa === "PROTOCOLO")
      .sort(sortByDataLimite);
    const usedProtocolo = new Set<string>();

    for (const revisar of revisarList) {
      let best: ViosTask | null = null;
      let bestScore = Infinity;
      for (const protocolo of protocoloList) {
        if (usedProtocolo.has(protocolo.vios_id)) continue;
        const score = viosPairingScore(revisar, protocolo);
        if (score < bestScore) {
          bestScore = score;
          best = protocolo;
        }
      }
      if (best && bestScore <= MAX_PAIRING_SCORE) {
        usedProtocolo.add(best.vios_id);
        pairMap.set(revisar.vios_id, best.vios_id);
        pairMap.set(best.vios_id, revisar.vios_id);
      }
    }
  }
  return pairMap;
}

async function enrichTasksWithPairs(tasks: ViosTask[]): Promise<ViosTask[]> {
  const needsPair = tasks.some(
    (t) => t.etiquetas_tarefa === "PROTOCOLO" || t.etiquetas_tarefa === "REVISAR"
  );
  if (!needsPair) return tasks;

  const processIds = [
    ...new Set(tasks.map((t) => t.ci_processo).filter(Boolean)),
  ] as string[];
  if (!processIds.length) return tasks;

  const inactive = await fetchInactiveCollaboratorIndex();
  const { data } = await supabase
    .from("vios_tasks")
    .select(VIOS_TASKS_SELECT)
    .in("ci_processo", processIds)
    .in("etiquetas_tarefa", ["PROTOCOLO", "REVISAR"]);

  const siblings = filterActiveCollaboratorTasks(
    (data ?? []).map((r) => mapTaskRow(r as unknown as ViosTaskRow)),
    inactive
  );
  const byId = new Map(siblings.map((t) => [t.vios_id, t]));
  const pairMap = buildViosPairMap(siblings);

  return tasks.map((t) => {
    const pairedId = pairMap.get(t.vios_id);
    if (!pairedId) return t;
    return { ...t, paired_task: byId.get(pairedId) ?? null };
  });
}

/** Busca a tarefa pareada (PROTOCOLO ↔ REVISAR) no mesmo processo. */
export async function findPairedViosTask(
  task: Pick<ViosTask, "vios_id" | "ci_processo" | "etiquetas_tarefa" | "data_limite">
): Promise<ViosTask | null> {
  if (!task.ci_processo) return null;
  const targetEtiqueta =
    task.etiquetas_tarefa === "REVISAR"
      ? "PROTOCOLO"
      : task.etiquetas_tarefa === "PROTOCOLO"
        ? "REVISAR"
        : null;
  if (!targetEtiqueta) return null;

  const inactive = await fetchInactiveCollaboratorIndex();
  const { data } = await supabase
    .from("vios_tasks")
    .select(VIOS_TASKS_SELECT)
    .eq("ci_processo", task.ci_processo)
    .eq("etiquetas_tarefa", targetEtiqueta);

  const candidates = filterActiveCollaboratorTasks(
    (data ?? []).map((r) => mapTaskRow(r as unknown as ViosTaskRow)),
    inactive
  ).filter((c) => c.vios_id !== task.vios_id);

  if (!candidates.length) return null;

  const self = task as ViosTask;
  let best: ViosTask | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const score = viosPairingScore(self, c);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best && bestScore <= MAX_PAIRING_SCORE ? best : null;
}

async function linkViosTaskAndPairToPlanner(
  viosId: string,
  requestId: string
): Promise<{ error: string | null }> {
  const { data: task } = await supabase
    .from("vios_tasks")
    .select(VIOS_TASKS_SELECT)
    .eq("vios_id", viosId)
    .single();

  if (!task) return { error: "Tarefa não encontrada" };

  const paired = await findPairedViosTask(task as ViosTask);
  const idsToLink = [viosId];
  if (paired && !paired.marketing_request_id) {
    idsToLink.push(paired.vios_id);
  }

  const { error } = await supabase
    .from("vios_tasks")
    .update({
      marketing_request_id: requestId,
      updated_at: new Date().toISOString(),
    })
    .in("vios_id", idsToLink);

  if (error) return { error: error.message };
  return { error: null };
}

function sortViosTasks(
  tasks: ViosTask[],
  orderBy: FetchViosTasksParams["orderBy"]
): ViosTask[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    switch (orderBy) {
      case "data_limite_desc":
        return (b.data_limite ?? "").localeCompare(a.data_limite ?? "");
      case "data_conclusao_desc":
        return (b.data_conclusao ?? "").localeCompare(a.data_conclusao ?? "");
      case "area":
        return (a.area_processo ?? "").localeCompare(b.area_processo ?? "");
      default:
        return (a.data_limite ?? "").localeCompare(b.data_limite ?? "");
    }
  });
  return sorted;
}

/** Retorna o primeiro responsável da lista, excluindo o analista. */
function getFirstResponsavelExcludingLeonardo(responsaveis: string | null): string {
  const filtered = filterLeonardoFromResponsaveis(responsaveis);
  return (filtered ?? "").split(/\s*\|\s*/)[0]?.trim() ?? "";
}

/** Etiqueta REVISAR: gestor validou o material — pronta para o Planner. */
export function isRevisaoConcluida(task: ViosTask): boolean {
  return (task.etiquetas_tarefa ?? "").trim().toUpperCase() === "REVISAR" && task.status === "concluido";
}

/** @deprecated Use isRevisaoConcluida — mantido para compatibilidade. */
export function isProtocolar(task: ViosTask): boolean {
  return isRevisaoConcluida(task);
}

/** Situação de entrega para filtros e indicadores visuais. */
export function getViosEntregaSituacao(task: ViosTask): ViosEntregaSituacao {
  if (!task.data_limite) return "sem_prazo";
  if (task.status !== "concluido") {
    const limit = new Date(task.data_limite + "T12:00:00");
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return limit < today ? "atrasada" : "aguardando";
  }
  if (!task.data_conclusao) return "sem_prazo";
  return isEntregueNoPrazo(task) ? "no_prazo" : "entregue_atrasada";
}

/** Retorna se a entrega foi no prazo (data_conclusao <= data_limite). */
export function isEntregueNoPrazo(task: ViosTask): boolean | null {
  if (!task.data_conclusao || !task.data_limite) return null;
  const conclusao = new Date(task.data_conclusao);
  conclusao.setHours(0, 0, 0, 0);
  const limite = new Date(task.data_limite + "T12:00:00");
  limite.setHours(0, 0, 0, 0);
  return conclusao <= limite;
}

function viosDataLimite(task: ViosTask): Date | null {
  if (!task.data_limite) return null;
  const d = new Date(task.data_limite + "T12:00:00");
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Dias de atraso em relação ao prazo.
 * Concluída: dias entre conclusão e limite (0 = no prazo).
 * Aberta: dias entre hoje e limite (positivo = atrasada).
 */
export function getViosAtrasoDias(
  task: ViosTask,
  referenceDate: Date = new Date()
): number | null {
  const limite = viosDataLimite(task);
  if (!limite) return null;

  if (task.status === "concluido" && task.data_conclusao) {
    const conclusao = new Date(task.data_conclusao);
    conclusao.setHours(0, 0, 0, 0);
    return Math.max(0, differenceInCalendarDays(conclusao, limite));
  }

  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return differenceInCalendarDays(ref, limite);
}

/** Texto legível de atraso, prazo restante ou entrega no prazo. */
export function formatViosAtrasoLabel(task: ViosTask): string | null {
  const limite = viosDataLimite(task);
  if (!limite) return null;

  const situacao = getViosEntregaSituacao(task);

  if (situacao === "aguardando") {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const restantes = differenceInCalendarDays(limite, hoje);
    if (restantes === 0) return "Prazo é hoje";
    if (restantes === 1) return "Falta 1 dia para o prazo";
    return `Faltam ${restantes} dias para o prazo`;
  }

  const dias = getViosAtrasoDias(task);
  if (dias === null) return null;

  if (situacao === "atrasada") {
    if (dias === 1) return "1 dia de atraso";
    return `${dias} dias de atraso`;
  }

  if (situacao === "entregue_atrasada") {
    if (dias === 1) return "Entregue com 1 dia de atraso";
    return `Entregue com ${dias} dias de atraso`;
  }

  if (situacao === "no_prazo") {
    return "Entregue no prazo";
  }

  return null;
}

/** Tarefa elegível para criar solicitação no Planner (revisão do gestor concluída). */
export function canSendToPlanner(task: ViosTask): boolean {
  if (task.marketing_request_id) return false;
  return isRevisaoConcluida(task);
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
  situacaoEntrega?: ViosEntregaSituacao | "";
  ci?: string;
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
    situacaoEntrega,
    ci,
    orderBy = "data_limite_asc",
  } = params;

  const today = new Date().toISOString().slice(0, 10);
  const entregaNeedsClientFilter =
    situacaoEntrega === "no_prazo" || situacaoEntrega === "entregue_atrasada";
  const inactive = await fetchInactiveCollaboratorIndex();
  const needsClientPagination =
    entregaNeedsClientFilter || inactive.users.length > 0;

  let query = supabase
    .from("vios_tasks")
    .select(`${VIOS_TASKS_SELECT}, users(name, avatar_url)`, {
      count: needsClientPagination ? undefined : "exact",
    });

  if (!needsClientPagination) {
    query = query.range(offset, offset + limit - 1);
  }

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
  if (ci && ci.trim() !== "") {
    query = query.ilike("vios_id", `%${ci.trim()}%`);
  }
  if (jaNoPlanner === true) {
    query = query.not("marketing_request_id", "is", null);
  } else if (jaNoPlanner === false) {
    query = query.is("marketing_request_id", null);
  }

  if (situacaoEntrega === "atrasada") {
    query = query.neq("status", "concluido").lt("data_limite", today);
  } else if (situacaoEntrega === "aguardando") {
    query = query.neq("status", "concluido").gte("data_limite", today);
  } else if (entregaNeedsClientFilter) {
    query = query
      .eq("status", "concluido")
      .not("data_conclusao", "is", null)
      .not("data_limite", "is", null);
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
  let tasks = rows.map(mapTaskRow);
  tasks = filterActiveCollaboratorTasks(tasks, inactive);

  if (entregaNeedsClientFilter && situacaoEntrega) {
    tasks = tasks.filter((t) => getViosEntregaSituacao(t) === situacaoEntrega);
  }

  if (needsClientPagination) {
    tasks = sortViosTasks(tasks, orderBy);
    const totalFiltered = tasks.length;
    tasks = tasks.slice(offset, offset + limit);
    tasks = await enrichTasksWithPairs(tasks);
    return { tasks, total: totalFiltered };
  }

  tasks = await enrichTasksWithPairs(tasks);
  return { tasks, total: count ?? tasks.length };
}

/**
 * Resumo operacional para cards no topo da página.
 */
export async function fetchViosTaskStats(): Promise<ViosTaskStats> {
  const inactive = await fetchInactiveCollaboratorIndex();
  const { data, error } = await supabase
    .from("vios_tasks")
    .select(
      "status, data_limite, data_conclusao, marketing_request_id, etiquetas_tarefa, assignee_id, responsaveis"
    );

  if (error || !data) {
    return {
      total: 0,
      aguardando: 0,
      atrasadas: 0,
      concluidasNoPrazo: 0,
      concluidasAtrasadas: 0,
      prontasPlanner: 0,
      noPlanner: 0,
    };
  }

  const stats: ViosTaskStats = {
    total: 0,
    aguardando: 0,
    atrasadas: 0,
    concluidasNoPrazo: 0,
    concluidasAtrasadas: 0,
    prontasPlanner: 0,
    noPlanner: 0,
  };

  for (const row of data) {
    const task = row as Pick<
      ViosTask,
      | "status"
      | "data_limite"
      | "data_conclusao"
      | "marketing_request_id"
      | "etiquetas_tarefa"
      | "assignee_id"
      | "responsaveis"
    >;
    if (isInactiveCollaboratorTask(task, inactive)) continue;

    stats.total++;
    const situacao = getViosEntregaSituacao(task as ViosTask);
    if (situacao === "aguardando") stats.aguardando++;
    if (situacao === "atrasada") stats.atrasadas++;
    if (situacao === "no_prazo") stats.concluidasNoPrazo++;
    if (situacao === "entregue_atrasada") stats.concluidasAtrasadas++;
    if (!task.marketing_request_id) stats.noPlanner++;
    if (canSendToPlanner(task as ViosTask)) stats.prontasPlanner++;
  }

  return stats;
}

/**
 * Busca todas as tarefas VIOS vinculadas a uma solicitação do Planner.
 */
export async function fetchViosTasksByMarketingRequestId(
  requestId: string
): Promise<ViosTask[]> {
  const { data, error } = await supabase
    .from("vios_tasks")
    .select(VIOS_TASKS_SELECT)
    .eq("marketing_request_id", requestId);

  if (error || !data?.length) return [];
  const tasks = (data as unknown as ViosTaskRow[]).map(mapTaskRow);
  return enrichTasksWithPairs(tasks);
}

/**
 * Busca a tarefa VIOS vinculada a uma solicitação do Planner (marketing_request_id = requestId).
 * Preferência: REVISAR (tarefa principal enviada ao Planner).
 */
export async function fetchViosTaskByMarketingRequestId(
  requestId: string
): Promise<ViosTask | null> {
  const tasks = await fetchViosTasksByMarketingRequestId(requestId);
  if (!tasks.length) return null;
  return tasks.find((t) => t.etiquetas_tarefa === "REVISAR") ?? tasks[0];
}

/**
 * Lista etiquetas distintas para os filtros (query leve).
 */
export async function fetchViosTaskEtiquetas(): Promise<string[]> {
  const inactive = await fetchInactiveCollaboratorIndex();
  const { data, error } = await supabase
    .from("vios_tasks")
    .select("etiquetas_tarefa, assignee_id, responsaveis")
    .not("etiquetas_tarefa", "is", null);

  if (error) {
    console.error("Erro ao buscar etiquetas VIOS:", error);
    return [];
  }

  const set = new Set<string>();
  (data ?? []).forEach((r: { etiquetas_tarefa: string | null; assignee_id: string | null; responsaveis: string | null }) => {
    if (isInactiveCollaboratorTask(r, inactive)) return;
    if (r.etiquetas_tarefa?.trim()) set.add(r.etiquetas_tarefa.trim());
  });
  return Array.from(set).sort();
}

/**
 * Lista áreas distintas para os filtros.
 */
export async function fetchViosTaskAreas(): Promise<string[]> {
  const inactive = await fetchInactiveCollaboratorIndex();
  const { data, error } = await supabase
    .from("vios_tasks")
    .select("area_processo, assignee_id, responsaveis")
    .not("area_processo", "is", null);

  if (error) {
    console.error("Erro ao buscar áreas VIOS:", error);
    return [];
  }

  const set = new Set<string>();
  (data ?? []).forEach((r: { area_processo: string | null; assignee_id: string | null; responsaveis: string | null }) => {
    if (isInactiveCollaboratorTask(r, inactive)) return;
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

  const { error: linkErr } = await linkViosTaskAndPairToPlanner(viosId, inserted.id);
  if (linkErr) return { error: linkErr };
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

  const { error: linkErr } = await linkViosTaskAndPairToPlanner(viosId, inserted.id);
  if (linkErr) return { error: linkErr };
  return { error: null, requestId: inserted.id };
}
