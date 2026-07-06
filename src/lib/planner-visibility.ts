import type { WorkflowStageConfig } from "@/lib/app-settings";
import type { MarketingRequest } from "@/lib/marketing-requests";

/** Leonardo Marques — único usuário com visão da coluna Tarefas Leonardo. */
export const LEONARDO_USER_ID = "2f08c695-770e-47ce-b4e4-ce27fa414df8";

export function canUserSeeWorkflowStage(
  stage: WorkflowStageConfig,
  userId: string | null | undefined,
  isAdmin: boolean
): boolean {
  const restricted = stage.visibleToUserIds;
  if (!restricted?.length) return true;
  if (isAdmin) return true;
  if (!userId) return false;
  return restricted.includes(userId);
}

export function filterWorkflowStagesForUser(
  stages: WorkflowStageConfig[],
  userId: string | null | undefined,
  isAdmin: boolean
): WorkflowStageConfig[] {
  return stages.filter((stage) => canUserSeeWorkflowStage(stage, userId, isAdmin));
}

export function filterRequestsByStageVisibility(
  requests: MarketingRequest[],
  stages: WorkflowStageConfig[],
  userId: string | null | undefined,
  isAdmin: boolean
): MarketingRequest[] {
  const hiddenStages = new Set(
    stages
      .filter((stage) => !canUserSeeWorkflowStage(stage, userId, isAdmin))
      .map((stage) => stage.value)
  );
  if (hiddenStages.size === 0) return requests;
  return requests.filter((req) => !hiddenStages.has(req.workflow_stage ?? ""));
}
