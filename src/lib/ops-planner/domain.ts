/**
 * Regras puras do Planner de Operações Legais: datas no fuso de São Paulo,
 * permissões por papel no espaço, faixas de prazo e indicadores da Gestão.
 */

import type {
  OpsMember,
  OpsSpaceRole,
  OpsTask,
  OpsTaskStatus,
} from "./types";

const SAO_PAULO_TZ = "America/Sao_Paulo";

/** Data de hoje (AAAA-MM-DD) em São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TZ }).format(now);
}

/** Data (AAAA-MM-DD) em São Paulo de um timestamp. */
export function dateInSaoPaulo(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return todayInSaoPaulo(date);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Dias corridos de `from` até `to` (positivo quando `to` é depois). */
export function diffDays(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Dias úteis depois de `since` até `today` (inclusive), sem contar o próprio `since`. */
export function businessDaysSince(since: string, today: string, ehDiaUtil: (iso: string) => boolean): number {
  if (since >= today) return 0;
  let count = 0;
  for (let day = addDays(since, 1); day <= today; day = addDays(day, 1)) {
    if (ehDiaUtil(day)) count += 1;
  }
  return count;
}

export function isOpenStatus(status: OpsTaskStatus): boolean {
  return status !== "concluida" && status !== "cancelada";
}

export function isOverdue(task: Pick<OpsTask, "status" | "due_date">, today: string): boolean {
  return isOpenStatus(task.status) && Boolean(task.due_date) && (task.due_date as string) < today;
}

/* ------------------------------------------------------------ permissões */

export interface OpsAccess {
  userId: string;
  isAdmin: boolean;
  memberships: OpsMember[];
}

export function roleInSpace(access: OpsAccess, spaceId: string): OpsSpaceRole | null {
  return access.memberships.find((member) => member.space_id === spaceId)?.role ?? null;
}

export function canViewSpace(access: OpsAccess, spaceId: string): boolean {
  return access.isAdmin || roleInSpace(access, spaceId) !== null;
}

/** Líder e gestor administram o espaço: membros, listas, limite e rotinas. */
export function canManageSpace(access: OpsAccess, spaceId: string): boolean {
  if (access.isAdmin) return true;
  const role = roleInSpace(access, spaceId);
  return role === "gestor" || role === "lider";
}

/** Quem vê o espaço edita; responsável de outro espaço edita a própria tarefa. */
export function canEditTask(access: OpsAccess, task: Pick<OpsTask, "space_id" | "assignee_ids">): boolean {
  return canViewSpace(access, task.space_id) || task.assignee_ids.includes(access.userId);
}

export function canArchiveTask(
  access: OpsAccess,
  task: Pick<OpsTask, "space_id" | "created_by">
): boolean {
  return canManageSpace(access, task.space_id) || task.created_by === access.userId;
}

/** Espaços que entram na Gestão: todos para admin, senão onde é líder ou gestor. */
export function managedSpaceIds(access: OpsAccess, allSpaceIds: string[]): string[] {
  if (access.isAdmin) return allSpaceIds;
  return access.memberships
    .filter((member) => member.role === "gestor" || member.role === "lider")
    .map((member) => member.space_id);
}

/* ------------------------------------------------------------ prazos */

export const DUE_BUCKETS = ["atrasada", "hoje", "proximos_7", "depois", "sem_prazo"] as const;
export type DueBucket = (typeof DUE_BUCKETS)[number];

export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  atrasada: "Atrasadas",
  hoje: "Hoje",
  proximos_7: "Próximos 7 dias",
  depois: "Depois",
  sem_prazo: "Sem prazo",
};

export function dueBucket(dueDate: string | null, today: string): DueBucket {
  if (!dueDate) return "sem_prazo";
  if (dueDate < today) return "atrasada";
  if (dueDate === today) return "hoje";
  if (dueDate <= addDays(today, 7)) return "proximos_7";
  return "depois";
}

export const MY_TASK_GROUPS = [...DUE_BUCKETS, "aguardando"] as const;
export type MyTaskGroup = (typeof MY_TASK_GROUPS)[number];

export const MY_TASK_GROUP_LABEL: Record<MyTaskGroup, string> = {
  ...DUE_BUCKET_LABEL,
  aguardando: "Aguardando outra pessoa",
};

/** Em Minhas tarefas o que está em "Aguardando" fica num grupo à parte, salvo se já venceu. */
export function myTaskGroup(task: Pick<OpsTask, "status" | "due_date">, today: string): MyTaskGroup {
  const bucket = dueBucket(task.due_date, today);
  if (task.status === "aguardando" && bucket !== "atrasada") return "aguardando";
  return bucket;
}

/** Concluída no prazo? null quando não tinha prazo ou não foi concluída. */
export function finishedOnTime(task: Pick<OpsTask, "status" | "due_date" | "completed_at">): boolean | null {
  if (task.status !== "concluida" || !task.due_date) return null;
  const done = dateInSaoPaulo(task.completed_at);
  if (!done) return null;
  return done <= task.due_date;
}

/** Mudar um prazo que já existia conta como reprogramação (regra da planilha do RH). */
export function isReschedule(previousDue: string | null, nextDue: string | null): boolean {
  return Boolean(previousDue) && previousDue !== nextDue;
}

/* ------------------------------------------------------------ gestão */

export const WAITING_ESCALATION_BUSINESS_DAYS = 5;
export const OVERDUE_ESCALATION_BUSINESS_DAYS = 2;

/** Tarefas em andamento por pessoa (limite de WIP do espaço). */
export function wipByPerson(tasks: Array<Pick<OpsTask, "status" | "assignee_ids">>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.status !== "em_andamento") continue;
    for (const id of task.assignee_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export interface OpsKpis {
  open: number;
  overdue: number;
  dueNext7: number;
  waitingStale: number;
  doneThisMonth: number;
  onTimePct: number | null;
}

type KpiTask = Pick<OpsTask, "status" | "due_date" | "completed_at" | "waiting_since">;

export function computeKpis(tasks: KpiTask[], today: string, ehDiaUtil: (iso: string) => boolean): OpsKpis {
  const month = today.slice(0, 7);
  const limit7 = addDays(today, 7);
  let open = 0;
  let overdue = 0;
  let dueNext7 = 0;
  let waitingStale = 0;
  let doneThisMonth = 0;
  let withDue = 0;
  let onTime = 0;
  for (const task of tasks) {
    if (isOpenStatus(task.status)) {
      open += 1;
      if (task.due_date && task.due_date < today) overdue += 1;
      else if (task.due_date && task.due_date <= limit7) dueNext7 += 1;
      if (
        task.status === "aguardando" &&
        task.waiting_since &&
        businessDaysSince(task.waiting_since, today, ehDiaUtil) > WAITING_ESCALATION_BUSINESS_DAYS
      ) {
        waitingStale += 1;
      }
      continue;
    }
    if (task.status !== "concluida" || dateInSaoPaulo(task.completed_at)?.slice(0, 7) !== month) continue;
    doneThisMonth += 1;
    const result = finishedOnTime(task);
    if (result !== null) {
      withDue += 1;
      if (result) onTime += 1;
    }
  }
  return {
    open,
    overdue,
    dueNext7,
    waitingStale,
    doneThisMonth,
    onTimePct: withDue > 0 ? Math.round((onTime / withDue) * 100) : null,
  };
}

/** Ordem manual no quadro: valor entre o cartão de cima e o de baixo. */
export function sortOrderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}
