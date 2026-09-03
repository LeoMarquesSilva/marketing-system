import { describe, expect, it } from "vitest";
import type { ClientGroupGestorStatus } from "@/lib/client-group-gestor-status";
import {
  computeNpsWorkflowProgress,
  groupMatchesNpsWorkflowFilter,
  isNpsClassificationPending,
} from "@/lib/nps/workflow-progress";

const pendingStatus: ClientGroupGestorStatus = {
  gestorAtividade: null,
  inativoEncerramentoTipo: null,
  contratoVigenciaTermino: null,
  rescisaoContratualData: null,
  confirmedAt: null,
  confirmedByUserId: null,
};

const ativoStatus: ClientGroupGestorStatus = {
  ...pendingStatus,
  gestorAtividade: "ativo",
  confirmedAt: "2026-09-02T00:00:00Z",
  confirmedByUserId: "u1",
};

const inativoStatus: ClientGroupGestorStatus = {
  ...pendingStatus,
  gestorAtividade: "inativo",
  inativoEncerramentoTipo: "rescisao_contratual",
  rescisaoContratualData: "2026-08-01",
  confirmedAt: "2026-09-02T00:00:00Z",
  confirmedByUserId: "u1",
};

describe("NPS workflow progress", () => {
  it("conta status pendente só em grupos com id", () => {
    const progress = computeNpsWorkflowProgress([
      {
        clientGroupId: "g1",
        gestorStatus: pendingStatus,
        members: [{ invitesClassifiedByUserId: null }],
      },
      {
        clientGroupId: "g2",
        gestorStatus: ativoStatus,
        members: [{ invitesClassifiedByUserId: "u1" }],
      },
      {
        clientGroupId: null,
        gestorStatus: pendingStatus,
        members: [],
      },
    ]);
    expect(progress.groupsWithId).toBe(2);
    expect(progress.statusPending).toBe(1);
    expect(progress.statusConfirmed).toBe(1);
  });

  it("exclui grupo inativo confirmado da fila de classificação NPS", () => {
    const progress = computeNpsWorkflowProgress([
      {
        clientGroupId: "g-inativo",
        gestorStatus: inativoStatus,
        members: [{ invitesClassifiedByUserId: null }],
      },
      {
        clientGroupId: "g-ativo",
        gestorStatus: ativoStatus,
        members: [
          { invitesClassifiedByUserId: null },
          { invitesClassifiedByUserId: "u1" },
        ],
      },
    ]);
    expect(progress.npsPeopleTotal).toBe(2);
    expect(progress.npsPending).toBe(1);
    expect(progress.npsClassified).toBe(1);
  });

  it("identifica pessoa ainda sem classificação NPS", () => {
    expect(isNpsClassificationPending({ invitesClassifiedByUserId: null })).toBe(true);
    expect(isNpsClassificationPending({ invitesClassifiedByUserId: "u1" })).toBe(false);
  });

  it("filtra grupos com status pendente ou NPS sem classificar", () => {
    const pendingGroup = {
      clientGroupId: "g1",
      gestorStatus: pendingStatus,
      members: [{ invitesClassifiedByUserId: null }],
    };
    const classifiedActive = {
      clientGroupId: "g2",
      gestorStatus: ativoStatus,
      members: [{ invitesClassifiedByUserId: "u1" }],
    };
    expect(groupMatchesNpsWorkflowFilter(pendingGroup, "status_pending")).toBe(true);
    expect(groupMatchesNpsWorkflowFilter(classifiedActive, "status_pending")).toBe(false);
    expect(groupMatchesNpsWorkflowFilter(pendingGroup, "nps_pending")).toBe(true);
    expect(groupMatchesNpsWorkflowFilter(classifiedActive, "nps_pending")).toBe(false);
    expect(
      groupMatchesNpsWorkflowFilter(
        {
          clientGroupId: "g3",
          gestorStatus: inativoStatus,
          members: [{ invitesClassifiedByUserId: null }],
        },
        "nps_pending"
      )
    ).toBe(false);
  });
});
