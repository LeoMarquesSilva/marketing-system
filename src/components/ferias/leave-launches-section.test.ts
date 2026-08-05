import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  groupVacationLaunches,
  LeaveLaunchesSection,
} from "@/components/ferias/leave-launches-section";
import type { VacationLeave, VacationLeaveKind } from "@/lib/ferias/types";

function leave(
  id: string,
  kind: VacationLeaveKind,
  startDate: string,
  endDate: string,
  days: number
): VacationLeave {
  return {
    id,
    employee_id: "employee-1",
    start_date: startDate,
    end_date: endDate,
    days,
    kind,
    notes: null,
  };
}

describe("groupVacationLaunches", () => {
  it("vincula o crédito ao período de mesma natureza que contém suas datas", () => {
    const recess = leave("recess", "recesso", "2025-12-20", "2026-01-06", 18);
    const vacation = leave("vacation", "ferias", "2025-12-03", "2025-12-12", 10);
    const recessCredit = leave(
      "recess-credit",
      "trabalho_recesso",
      "2025-12-22",
      "2025-12-22",
      1
    );
    const vacationCredit = leave(
      "vacation-credit",
      "trabalho_ferias",
      "2025-12-05",
      "2025-12-05",
      1
    );

    const result = groupVacationLaunches([
      recess,
      vacation,
      recessCredit,
      vacationCredit,
    ]);

    expect(result.groups).toEqual([
      { leave: recess, credits: [recessCredit] },
      { leave: vacation, credits: [vacationCredit] },
    ]);
    expect(result.unlinkedCredits).toEqual([]);
  });

  it("mantém visível o crédito que não pertence a nenhum período", () => {
    const vacation = leave("vacation", "ferias", "2025-12-03", "2025-12-12", 10);
    const oldCredit = leave(
      "old-credit",
      "trabalho_ferias",
      "2024-06-03",
      "2024-06-03",
      1
    );

    const result = groupVacationLaunches([vacation, oldCredit]);

    expect(result.groups).toEqual([{ leave: vacation, credits: [] }]);
    expect(result.unlinkedCredits).toEqual([oldCredit]);
  });
});

describe("LeaveLaunchesSection", () => {
  it("apresenta a compensação dentro do período e nomeia claramente a ação", () => {
    const recess = leave("recess", "recesso", "2025-12-20", "2026-01-06", 18);
    const recessCredit = leave(
      "recess-credit",
      "trabalho_recesso",
      "2025-12-22",
      "2025-12-22",
      1
    );

    const markup = renderToStaticMarkup(
      createElement(LeaveLaunchesSection, {
        leaves: [recess, recessCredit],
        error: null,
        onRegisterWorkedDay: () => undefined,
        onEdit: () => undefined,
        onDelete: () => undefined,
      })
    );

    expect(markup).toContain("Registrar dia trabalhado");
    expect(markup).toContain("1 dia devolvido ao saldo");
    expect(markup).toContain("Créditos neste período");
    expect(markup).toContain('aria-label="Editar Recesso de 20/12/2025');
    expect(markup.indexOf("RECESSO")).toBeLessThan(
      markup.indexOf("Créditos neste período")
    );
  });
});
