import type { ClientGroupGestorStatus, GestorAtividade } from "@/lib/client-group-gestor-status";
import { isGestorStatusPending } from "@/lib/client-group-gestor-status";


export type NpsWorkflowFilter = "all" | "status_pending" | "nps_pending";

export interface NpsWorkflowProgress {
  groupsWithId: number;
  statusConfirmed: number;
  statusPending: number;
  npsPeopleTotal: number;
  npsClassified: number;
  npsPending: number;
}

export function isNpsClassificationPending(member: {
  invitesClassifiedByUserId?: string | null;
}): boolean {
  return !member.invitesClassifiedByUserId;
}

export function parseNpsWorkflowFilterParam(
  value: string | null | undefined
): NpsWorkflowFilter {
  if (value === "status_pending" || value === "nps_pending") return value;
  return "all";
}

function resolvedAtividade(
  gestorAtividade: GestorAtividade | null | undefined
): GestorAtividade | null {
  return gestorAtividade === "ativo" || gestorAtividade === "inativo" ? gestorAtividade : null;
}

/** Grupos inativos confirmados saem da fila de classificação NPS. */
export function groupCountsTowardNpsClassification(
  gestorAtividade: GestorAtividade | null | undefined
): boolean {
  return resolvedAtividade(gestorAtividade) !== "inativo";
}

export function groupMatchesNpsWorkflowFilter(
  group: {
    clientGroupId: string | null;
    gestorAtividade?: GestorAtividade | null;
    gestorStatus?: ClientGroupGestorStatus | null;
    members: Array<{ invitesClassifiedByUserId?: string | null }>;
  },
  filter: NpsWorkflowFilter
): boolean {
  if (filter === "all") return true;
  const atividade =
    group.gestorAtividade ?? group.gestorStatus?.gestorAtividade ?? null;
  if (filter === "status_pending") {
    return Boolean(group.clientGroupId) && !atividade;
  }
  if (!groupCountsTowardNpsClassification(atividade)) return false;
  return group.members.some(isNpsClassificationPending);
}

export function computeNpsWorkflowProgress(
  groups: Array<{
    clientGroupId: string | null;
    gestorAtividade?: GestorAtividade | null;
    gestorStatus?: ClientGroupGestorStatus | null;
    members: Array<{ invitesClassifiedByUserId?: string | null }>;
  }>
): NpsWorkflowProgress {
  let groupsWithId = 0;
  let statusConfirmed = 0;
  let npsPeopleTotal = 0;
  let npsClassified = 0;

  for (const group of groups) {
    const atividade =
      group.gestorAtividade ?? group.gestorStatus?.gestorAtividade ?? null;
    const status = group.gestorStatus ?? {
      gestorAtividade: atividade,
      inativoEncerramentoTipo: null,
      contratoVigenciaTermino: null,
      rescisaoContratualData: null,
      confirmedAt: null,
      confirmedByUserId: null,
    };

    if (group.clientGroupId) {
      groupsWithId += 1;
      if (!isGestorStatusPending(status)) statusConfirmed += 1;
    }

    if (!groupCountsTowardNpsClassification(atividade)) continue;
    for (const member of group.members) {
      npsPeopleTotal += 1;
      if (!isNpsClassificationPending(member)) npsClassified += 1;
    }
  }

  return {
    groupsWithId,
    statusConfirmed,
    statusPending: Math.max(0, groupsWithId - statusConfirmed),
    npsPeopleTotal,
    npsClassified,
    npsPending: Math.max(0, npsPeopleTotal - npsClassified),
  };
}
