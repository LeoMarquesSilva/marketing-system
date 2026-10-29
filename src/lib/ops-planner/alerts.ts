/**
 * Alarmes do Planner de Operações Legais (puro): o cron diário passa as tarefas
 * abertas e recebe as notificações a gravar. A dedupe_key garante que rodar o
 * cron de novo no mesmo dia (ou no seguinte) não repete o aviso.
 */

import {
  OVERDUE_ESCALATION_BUSINESS_DAYS,
  WAITING_ESCALATION_BUSINESS_DAYS,
  addDays,
  businessDaysSince,
} from "./domain";
import type { EhDiaUtil } from "./recurrence";
import type { OpsNotificationKind, OpsTask } from "./types";

export type AlertTask = Pick<
  OpsTask,
  "id" | "space_id" | "title" | "status" | "due_date" | "assignee_ids" | "waiting_on" | "waiting_since" | "routine_id"
>;

export interface NewNotification {
  recipient_id: string;
  task_id: string | null;
  routine_id: string | null;
  kind: OpsNotificationKind;
  title: string;
  body: string | null;
  dedupe_key: string;
}

export interface AlertContext {
  today: string;
  ehDiaUtil: EhDiaUtil;
  spaceName: (spaceId: string) => string;
  /** Líderes e gestores do espaço (recebem escaladas e tarefas sem responsável). */
  spaceManagers: (spaceId: string) => string[];
  personName: (userId: string) => string;
}

export function formatShortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function nextBusinessDay(today: string, ehDiaUtil: EhDiaUtil): string {
  let day = addDays(today, 1);
  for (let i = 0; i < 31 && !ehDiaUtil(day); i += 1) day = addDays(day, 1);
  return day;
}

function names(ids: string[], ctx: AlertContext): string {
  return ids.map(ctx.personName).join(", ");
}

/** Avisos do dia: vence amanhã/hoje, atrasada e escaladas para o líder e o gestor. */
export function buildDailyNotifications(tasks: AlertTask[], ctx: AlertContext): NewNotification[] {
  const { today, ehDiaUtil } = ctx;
  const out: NewNotification[] = [];
  // Em dia útil, "amanhã" vai até o próximo dia útil (sexta avisa o que vence na segunda).
  const nextBusiness = ehDiaUtil(today) ? nextBusinessDay(today, ehDiaUtil) : null;

  const push = (
    recipients: string[],
    task: AlertTask,
    kind: OpsNotificationKind,
    key: string,
    title: string,
    body: string | null
  ) => {
    for (const recipient of new Set(recipients)) {
      out.push({
        recipient_id: recipient,
        task_id: task.id,
        routine_id: task.routine_id,
        kind,
        title,
        body,
        dedupe_key: `${kind}:${key}:${recipient}`,
      });
    }
  };

  for (const task of tasks) {
    if (task.status === "concluida" || task.status === "cancelada") continue;
    const space = ctx.spaceName(task.space_id);
    const managers = ctx.spaceManagers(task.space_id);
    // Sem responsável, quem precisa saber é a liderança do espaço.
    const owners = task.assignee_ids.length > 0 ? task.assignee_ids : managers;

    if (task.due_date) {
      const due = task.due_date;
      if (due === today) {
        push(owners, task, "vence_hoje", `${task.id}:${due}`, `Vence hoje: ${task.title}`, space);
      } else if (nextBusiness && due > today && due <= nextBusiness) {
        const label = due === addDays(today, 1) ? "Vence amanhã" : `Vence ${formatShortDate(due)}`;
        push(owners, task, "vence_amanha", `${task.id}:${due}`, `${label}: ${task.title}`, space);
      } else if (due < today) {
        push(owners, task, "atrasada", `${task.id}:${due}`, `Atrasada: ${task.title}`, `Venceu em ${formatShortDate(due)} · ${space}`);
        const late = businessDaysSince(due, today, ehDiaUtil);
        if (late > OVERDUE_ESCALATION_BUSINESS_DAYS) {
          const who = task.assignee_ids.length > 0 ? names(task.assignee_ids, ctx) : "sem responsável";
          push(
            managers.filter((id) => !task.assignee_ids.includes(id)),
            task,
            "escalada",
            `atraso:${task.id}:${due}`,
            `Atrasada há ${late} dias úteis: ${task.title}`,
            `${who} · ${space}`
          );
        }
      }
    }

    if (task.status === "aguardando" && task.waiting_since) {
      const stalled = businessDaysSince(task.waiting_since, today, ehDiaUtil);
      if (stalled > WAITING_ESCALATION_BUSINESS_DAYS) {
        const waitingOn = task.waiting_on?.trim() ? `Aguardando ${task.waiting_on.trim()}` : "Aguardando";
        push(
          managers.filter((id) => !task.assignee_ids.includes(id)),
          task,
          "escalada",
          `aguardando:${task.id}:${task.waiting_since}`,
          `Parada há ${stalled} dias úteis: ${task.title}`,
          `${waitingOn} · ${space}`
        );
      }
    }
  }
  return out;
}

/** Aviso de tarefa nova de rotina para os responsáveis (ou a liderança, se não tiver). */
export function buildRoutineGeneratedNotifications(tasks: AlertTask[], ctx: AlertContext): NewNotification[] {
  return tasks.flatMap((task) => {
    const recipients = task.assignee_ids.length > 0 ? task.assignee_ids : ctx.spaceManagers(task.space_id);
    const due = task.due_date ? `Vence em ${formatShortDate(task.due_date)} · ` : "";
    return [...new Set(recipients)].map((recipient) => ({
      recipient_id: recipient,
      task_id: task.id,
      routine_id: task.routine_id,
      kind: "rotina_gerada" as const,
      title: `Nova rotina: ${task.title}`,
      body: `${due}${ctx.spaceName(task.space_id)}`,
      dedupe_key: `rotina_gerada:${task.id}:${recipient}`,
    }));
  });
}

/** Quem entrou como responsável (sem avisar quem fez a mudança). */
export function newlyAssigned(previous: string[], next: string[], actorId: string): string[] {
  return next.filter((id) => !previous.includes(id) && id !== actorId);
}

/* ------------------------------------------------------------ resumo por e-mail */

export interface DigestItem {
  task_id: string;
  title: string;
  space: string;
  due_date: string | null;
  assignees: string;
}

export interface DigestTeamSection {
  space: string;
  overdue: DigestItem[];
  stalled: DigestItem[];
}

export interface Digest {
  overdue: DigestItem[];
  today: DigestItem[];
  next: DigestItem[];
  teams: DigestTeamSection[];
}

export function isDigestEmpty(digest: Digest): boolean {
  return (
    digest.overdue.length === 0 &&
    digest.today.length === 0 &&
    digest.next.length === 0 &&
    digest.teams.every((team) => team.overdue.length === 0 && team.stalled.length === 0)
  );
}

/**
 * Resumo de uma pessoa: as tarefas dela (atrasadas, hoje, próximo dia útil) e,
 * se for líder ou gestora, o que está atrasado ou parado nos espaços dela.
 */
export function buildDigest(
  userId: string,
  tasks: AlertTask[],
  managedSpaces: string[],
  ctx: AlertContext
): Digest {
  const { today, ehDiaUtil } = ctx;
  const nextBusiness = nextBusinessDay(today, ehDiaUtil);
  const toItem = (task: AlertTask): DigestItem => ({
    task_id: task.id,
    title: task.title,
    space: ctx.spaceName(task.space_id),
    due_date: task.due_date,
    assignees: task.assignee_ids.length > 0 ? names(task.assignee_ids, ctx) : "Sem responsável",
  });
  const byDue = (a: AlertTask, b: AlertTask) => (a.due_date ?? "").localeCompare(b.due_date ?? "");
  const open = tasks.filter((task) => task.status !== "concluida" && task.status !== "cancelada");
  const mine = open.filter((task) => task.assignee_ids.includes(userId)).sort(byDue);

  const teams = managedSpaces
    .map((spaceId) => {
      const spaceTasks = open.filter((task) => task.space_id === spaceId).sort(byDue);
      return {
        space: ctx.spaceName(spaceId),
        overdue: spaceTasks
          .filter((task) => task.due_date && businessDaysSince(task.due_date, today, ehDiaUtil) > OVERDUE_ESCALATION_BUSINESS_DAYS)
          .map(toItem),
        stalled: spaceTasks
          .filter(
            (task) =>
              task.status === "aguardando" &&
              task.waiting_since &&
              businessDaysSince(task.waiting_since, today, ehDiaUtil) > WAITING_ESCALATION_BUSINESS_DAYS
          )
          .map(toItem),
      };
    })
    .filter((team) => team.overdue.length > 0 || team.stalled.length > 0);

  return {
    overdue: mine.filter((task) => task.due_date && task.due_date < today).map(toItem),
    today: mine.filter((task) => task.due_date === today).map(toItem),
    next: mine.filter((task) => task.due_date && task.due_date > today && task.due_date <= nextBusiness).map(toItem),
    teams,
  };
}
