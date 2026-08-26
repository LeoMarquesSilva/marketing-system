import { describe, expect, it } from "vitest";
import { isCafeRosterEligible, planCafeRosterSync } from "./roster";

describe("planCafeRosterSync", () => {
  it("remove da escala automática contas fora do cadastro oficial e inclui colaboradores faltantes", () => {
    const plan = planCafeRosterSync(
      ["colaborador-1", "colaborador-2"],
      [
        {
          participantId: "participacao-oficial",
          userId: "colaborador-1",
          expectationSource: "automatic_roster",
          checkinAt: null,
        },
        {
          participantId: "participacao-institucional",
          userId: "conta-institucional",
          expectationSource: "automatic_roster",
          checkinAt: null,
        },
      ]
    );

    expect(plan).toEqual({
      missingUserIds: ["colaborador-2"],
      removableParticipantIds: ["participacao-institucional"],
    });
  });

  it("preserva registros externos corrigidos pelo admin ou que já possuem check-in", () => {
    const plan = planCafeRosterSync([], [
      {
        participantId: "participacao-admin",
        userId: "convidado-admin",
        expectationSource: "admin",
        checkinAt: null,
      },
      {
        participantId: "participacao-presente",
        userId: "convidado-presente",
        expectationSource: "automatic_roster",
        checkinAt: "2026-08-28T12:10:00.000Z",
      },
    ]);

    expect(plan).toEqual({
      missingUserIds: [],
      removableParticipantIds: [],
    });
  });
});

describe("isCafeRosterEligible", () => {
  it("não considera uma conta ativa como colaborador sem vínculo ativo no RH", () => {
    expect(isCafeRosterEligible({ userActive: true, hasActiveEmployee: false })).toBe(false);
    expect(isCafeRosterEligible({ userActive: true, hasActiveEmployee: true })).toBe(true);
  });
});
