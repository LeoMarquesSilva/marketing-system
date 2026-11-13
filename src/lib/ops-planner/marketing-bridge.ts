import "server-only";

import { WORKFLOW_STAGES } from "@/lib/constants";
import { dbFail, getOpsDb } from "./server";
import type { OpsMarketingItem } from "./types";

const STAGE_LABEL = new Map<string, string>(WORKFLOW_STAGES.map((stage) => [stage.value, stage.label]));

/**
 * Solicitações abertas do Planner de Marketing de cada pessoa. Só leitura: o
 * cartão abre o quadro de Marketing, que continua com o fluxo próprio.
 */
export async function listMarketingItems(userIds: string[]): Promise<OpsMarketingItem[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await getOpsDb()
    .from("marketing_requests")
    .select("id, title, workflow_stage, priority, deadline, deadline_time, assignee_id")
    .in("assignee_id", userIds)
    .neq("workflow_stage", "concluido")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) dbFail("carregar as solicitações de Marketing", error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    stage: STAGE_LABEL.get(row.workflow_stage as string) ?? String(row.workflow_stage ?? ""),
    priority: (row.priority as string | null) ?? null,
    due_date: (row.deadline as string | null)?.slice(0, 10) ?? null,
    due_time: (row.deadline_time as string | null) ?? null,
    assignee_id: (row.assignee_id as string | null) ?? null,
    href: `/planner?tarefa=${row.id as string}`,
  }));
}
