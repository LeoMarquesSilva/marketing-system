import { describe, expect, it } from "vitest";
import {
  buildVacationBalanceMessage,
  listVacationMessageYears,
} from "@/lib/ferias/message-template";
import type { EmployeeDetail } from "@/lib/ferias/types";

function sampleDetail(overrides?: Partial<EmployeeDetail["employee"]>): EmployeeDetail {
  return {
    employee: {
      id: "e1",
      user_id: null,
      full_name: "Felipe Soares de Camargo",
      cpf: null,
      email: "felipe@example.com",
      department: "Operações Legais",
      position: "Gerente",
      admission_date: "2018-01-10",
      termination_date: null,
      is_active: true,
      notes: null,
      vios_ci: null,
      vacation_exempt: false,
      avatar_url: null,
      ...overrides,
    },
    balance: {
      totalEntitledDays: 60,
      totalTakenDays: 40,
      pendingDays: 20,
      overdueDays: 0,
      dueTodayDays: 0,
      dueSoonDays: 15,
      onTimeDays: 15,
      unallocatedDays: 0,
      scheduledDays: 0,
      status: "a_vencer",
      currentPeriod: null,
      onLeaveNow: null,
      scheduledLeaves: [],
      periods: [
        {
          period: {
            id: "p1",
            employee_id: "e1",
            period_start: "2023-01-10",
            period_end: "2024-01-09",
            entitled_days: 30,
            concessive_start: "2024-01-10",
            concessive_end: "2025-01-09",
            notes: null,
          },
          usedDays: 30,
          remainingDays: 0,
          status: "quitado",
          daysUntilDeadline: 100,
          allocations: [],
        },
        {
          period: {
            id: "p2",
            employee_id: "e1",
            period_start: "2024-01-10",
            period_end: "2025-01-09",
            entitled_days: 30,
            concessive_start: "2025-01-10",
            concessive_end: "2026-01-09",
            notes: null,
          },
          usedDays: 10,
          remainingDays: 20,
          status: "a_vencer",
          daysUntilDeadline: 50,
          allocations: [],
        },
      ],
    },
    leaves: [
      {
        id: "l1",
        employee_id: "e1",
        start_date: "2023-07-01",
        end_date: "2023-07-15",
        days: 15,
        kind: "ferias",
        notes: null,
      },
      {
        id: "l2",
        employee_id: "e1",
        start_date: "2023-12-20",
        end_date: "2024-01-05",
        days: 10,
        kind: "recesso",
        notes: null,
      },
      {
        id: "l3",
        employee_id: "e1",
        start_date: "2024-12-23",
        end_date: "2024-12-23",
        days: 1,
        kind: "trabalho_recesso",
        notes: null,
      },
      {
        id: "l4",
        employee_id: "e1",
        start_date: "2024-08-01",
        end_date: "2024-08-10",
        days: 10,
        kind: "ferias",
        notes: null,
      },
    ],
  };
}

describe("buildVacationBalanceMessage", () => {
  it("lista lançamentos com tipo e datas no histórico completo", () => {
    const msg = buildVacationBalanceMessage(sampleDetail(), "whatsapp", { type: "all" });
    expect(msg.body).toContain("histórico completo");
    expect(msg.body).toContain("Lançamentos");
    expect(msg.body).toContain("Férias: 01/07/2023 a 15/07/2023 (15 dias)");
    expect(msg.body).toContain("Recesso: 20/12/2023 a 05/01/2024 (10 dias)");
    expect(msg.body).toContain("Dia trabalhado no recesso: 23/12/2024 (+1 dia)");
    expect(msg.body).toContain("Adquiridos: 60 dias");
  });

  it("filtra pelo ano e descreve só o recorte", () => {
    const msg = buildVacationBalanceMessage(sampleDetail(), "email", {
      type: "year",
      year: 2024,
    });
    expect(msg.subject).toBe("Saldo de férias — Felipe Soares de Camargo (2024)");
    expect(msg.body).toContain("ano de 2024");
    expect(msg.body).toContain("Férias: 01/08/2024 a 10/08/2024 (10 dias)");
    expect(msg.body).toContain("Recesso: 20/12/2023 a 05/01/2024 (10 dias)");
    expect(msg.body).not.toContain("01/07/2023 a 15/07/2023");
    expect(msg.body).toContain("Atenciosamente,");
  });

  it("trata isento sem inventar saldo", () => {
    const msg = buildVacationBalanceMessage(
      sampleDetail({ vacation_exempt: true }),
      "whatsapp"
    );
    expect(msg.body).toContain("fora do controle de férias");
    expect(msg.body).not.toContain("Adquiridos:");
  });

  it("lista anos a partir dos lançamentos e períodos", () => {
    expect(listVacationMessageYears(sampleDetail())).toEqual([
      2026, 2025, 2024, 2023,
    ]);
  });
});
