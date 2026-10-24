import "server-only";

import { loadEhDiaUtil } from "./business-days-server";
import {
  addDays,
  businessDaysSince,
  computeKpis,
  dateInSaoPaulo,
  finishedOnTime,
  isOpenStatus,
  isOverdue,
  managedSpaceIds,
  todayInSaoPaulo,
  WAITING_ESCALATION_BUSINESS_DAYS,
  wipByPerson,
} from "./domain";
import { listMarketingItems } from "./marketing-bridge";
import { dbFail, getOpsDb, listVisibleSpaces, type OpsActor } from "./server";
import { TASK_SELECT } from "./tasks-server";
import type { OpsOverview, OpsPersonLoad, OpsSpaceRole, OpsTask } from "./types";

/** Gestão: indicadores dos espaços que a pessoa lidera (gestor: todos os dela; admin: todos). */
export async function getOverview(actor: OpsActor): Promise<OpsOverview> {
  const today = todayInSaoPaulo();
  const visible = await listVisibleSpaces(actor);
  const managedIds = new Set(managedSpaceIds(actor, visible.map((space) => space.id)));
  const spaces = visible.filter((space) => managedIds.has(space.id));
  if (spaces.length === 0) return { today, spaces: [] };

  const db = getOpsDb();
  const monthStart = `${today.slice(0, 7)}-01T03:00:00Z`;
  const routineSince = addDays(today, -30);
  const spaceIds = spaces.map((space) => space.id);
  const [tasksResult, membersResult, routineTasksResult, ehDiaUtil] = await Promise.all([
    db
      .from("ops_tasks")
      .select(TASK_SELECT)
      .in("space_id", spaceIds)
      .is("archived_at", null)
      .or(`status.in.(a_fazer,em_andamento,aguardando),completed_at.gte.${monthStart}`)
      .limit(5000),
    db.from("ops_space_members").select("space_id, user_id, role").in("space_id", spaceIds),
    db
      .from("ops_tasks")
      .select("space_id, status, due_date, completed_at")
      .in("space_id", spaceIds)
      .not("routine_id", "is", null)
      .gte("occurrence_date", routineSince)
      .lte("occurrence_date", today)
      .is("archived_at", null),
    loadEhDiaUtil(),
  ]);
  if (tasksResult.error) dbFail("carregar as tarefas da Gestão", tasksResult.error);
  if (membersResult.error) dbFail("carregar os membros", membersResult.error);
  if (routineTasksResult.error) dbFail("carregar as rotinas", routineTasksResult.error);

  const tasks = (tasksResult.data ?? []) as OpsTask[];
  const members = membersResult.data ?? [];
  const marketingSpace = spaces.find((space) => space.slug === "marketing");
  const marketingItems = marketingSpace
    ? await listMarketingItems(members.filter((member) => member.space_id === marketingSpace.id).map((member) => member.user_id as string))
    : [];
  const month = today.slice(0, 7);

  return {
    today,
    spaces: spaces.map((space) => {
      const spaceTasks = tasks.filter((task) => task.space_id === space.id);
      const roles = new Map<string, OpsSpaceRole>(
        members.filter((member) => member.space_id === space.id).map((member) => [member.user_id as string, member.role as OpsSpaceRole])
      );
      // Quem é responsável por tarefa do espaço também entra, mesmo sendo de outro espaço.
      const peopleIds = new Set<string>([...roles.keys(), ...spaceTasks.flatMap((task) => task.assignee_ids)]);
      const wip = wipByPerson(spaceTasks);
      const people = [...peopleIds].map((userId): OpsPersonLoad => {
        const theirs = spaceTasks.filter((task) => task.assignee_ids.includes(userId));
        const open = theirs.filter((task) => isOpenStatus(task.status));
        const marketing = space.id === marketingSpace?.id ? marketingItems.filter((item) => item.assignee_id === userId) : [];
        return {
          user_id: userId,
          role: roles.get(userId) ?? null,
          a_fazer: open.filter((task) => task.status === "a_fazer").length,
          em_andamento: open.filter((task) => task.status === "em_andamento").length,
          aguardando: open.filter((task) => task.status === "aguardando").length,
          overdue: open.filter((task) => isOverdue(task, today)).length,
          waiting_stale: open.filter(
            (task) =>
              task.status === "aguardando" &&
              task.waiting_since &&
              businessDaysSince(task.waiting_since, today, ehDiaUtil) > WAITING_ESCALATION_BUSINESS_DAYS
          ).length,
          done_this_month: theirs.filter(
            (task) => task.status === "concluida" && dateInSaoPaulo(task.completed_at)?.slice(0, 7) === month
          ).length,
          over_wip: (wip.get(userId) ?? 0) > space.wip_limit,
          marketing_open: marketing.length,
          marketing_overdue: marketing.filter((item) => item.due_date && item.due_date < today).length,
        };
      });
      const routineTasks = (routineTasksResult.data ?? []).filter((task) => task.space_id === space.id) as Array<
        Pick<OpsTask, "status" | "due_date" | "completed_at">
      >;
      return {
        space,
        kpis: computeKpis(spaceTasks, today, ehDiaUtil),
        // Gestor está em todos os espaços: só aparece na tabela onde tem tarefa.
        people: people
          .filter((load) => load.role !== "gestor" || load.a_fazer + load.em_andamento + load.aguardando + load.done_this_month > 0)
          .sort((a, b) => b.overdue - a.overdue || b.em_andamento + b.a_fazer - (a.em_andamento + a.a_fazer)),
        routines: {
          generated: routineTasks.length,
          done_on_time: routineTasks.filter((task) => finishedOnTime(task) === true).length,
          done_late: routineTasks.filter((task) => finishedOnTime(task) === false).length,
          open_overdue: routineTasks.filter((task) => isOverdue(task, today)).length,
        },
      };
    }),
  };
}
