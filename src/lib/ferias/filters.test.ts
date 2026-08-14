import { describe, expect, it } from "vitest";
import {
  classifyVacationBalanceSign,
  computeFeriasKpis,
  dateRangesOverlap,
  employeeEligibleForRecess,
  filterEmployeesWithBalance,
  getInitials,
  listEmployeeDepartments,
  resolveCanonicalAreaLabel,
  resolveEmployeeAvatarUrl,
  summarizeRecessApplication,
} from "@/lib/ferias/filters";
import type { EmployeeBalance, EmployeeWithBalance, HrEmployee } from "@/lib/ferias/types";

function makeEmployee(
  overrides: Partial<HrEmployee> & { id: string; full_name: string }
): HrEmployee {
  return {
    user_id: null,
    cpf: null,
    email: null,
    department: "Operações Legais",
    position: "Analista",
    admission_date: "2020-08-05",
    termination_date: null,
    is_active: true,
    notes: null,
    vios_ci: null,
    vacation_exempt: false,
    avatar_url: null,
    ...overrides,
  };
}

function makeBalance(overrides: Partial<EmployeeBalance> = {}): EmployeeBalance {
  return {
    totalEntitledDays: 180,
    totalTakenDays: 129,
    pendingDays: 51,
    overdueDays: 0,
    dueTodayDays: 21,
    dueSoonDays: 0,
    onTimeDays: 30,
    unallocatedDays: 0,
    status: "a_vencer",
    periods: [],
    currentPeriod: null,
    onLeaveNow: null,
    ...overrides,
  };
}

function row(
  employee: HrEmployee,
  balance: Partial<EmployeeBalance> = {}
): EmployeeWithBalance {
  return { employee, balance: makeBalance(balance) };
}

const felipe = row(
  makeEmployee({
    id: "1",
    full_name: "Felipe Soares de Camargo",
    position: "Gerente",
    avatar_url: "https://example.com/felipe.jpg",
  }),
  { status: "a_vencer", pendingDays: 51, dueTodayDays: 21, dueSoonDays: 0, onTimeDays: 30, overdueDays: 0 }
);

const andressa = row(
  makeEmployee({
    id: "2",
    full_name: "Andressa da Silva",
    department: "Recursos Humanos",
    is_active: false,
  }),
  { status: "vencido", pendingDays: 10, overdueDays: 10, dueTodayDays: 0, dueSoonDays: 0, onTimeDays: 0 }
);

const samuel = row(
  makeEmployee({
    id: "3",
    full_name: "Samuel Willian Silva",
    position: "Controller",
  }),
  {
    status: "em_dia",
    pendingDays: 30,
    overdueDays: 0,
    dueTodayDays: 0,
    dueSoonDays: 0,
    onTimeDays: 30,
    onLeaveNow: {
      id: "l1",
      employee_id: "3",
      start_date: "2026-08-01",
      end_date: "2026-08-10",
      days: 10,
      kind: "ferias",
      notes: null,
    },
  }
);

describe("classifyVacationBalanceSign", () => {
  it("prioriza saldo negativo sobre residual positivo", () => {
    expect(classifyVacationBalanceSign({ pendingDays: -3, unallocatedDays: 3 })).toBe("a_mais");
    expect(classifyVacationBalanceSign({ pendingDays: 12, unallocatedDays: 0 })).toBe("a_tirar");
    expect(classifyVacationBalanceSign({ pendingDays: 0, unallocatedDays: 0 })).toBe("zerado");
  });
});

describe("filterEmployeesWithBalance", () => {
  const all = [felipe, andressa, samuel];

  it("por padrão lista só ativos", () => {
    const result = filterEmployeesWithBalance(all, {
      search: "",
      status: "all",
      situation: "ativos",
      department: "all",
    });
    expect(result.map((item) => item.employee.id)).toEqual(["1", "3"]);
  });

  it("filtra ex-colaboradores", () => {
    const result = filterEmployeesWithBalance(all, {
      search: "",
      status: "all",
      situation: "inativos",
      department: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0].employee.full_name).toBe("Andressa da Silva");
  });

  it("filtra por status do prazo concessivo", () => {
    const result = filterEmployeesWithBalance(all, {
      search: "",
      status: "a_vencer",
      situation: "all",
      department: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0].employee.id).toBe("1");
  });

  it("filtra por saldo positivo, negativo e zerado", () => {
    const overdrawn = row(
      makeEmployee({ id: "9", full_name: "Saldo Negativo" }),
      { pendingDays: -5, unallocatedDays: 5, status: "quitado" }
    );
    const zeroed = row(
      makeEmployee({ id: "10", full_name: "Saldo Zerado" }),
      { pendingDays: 0, unallocatedDays: 0, status: "quitado" }
    );
    const list = [felipe, samuel, overdrawn, zeroed];

    expect(
      filterEmployeesWithBalance(list, {
        search: "",
        status: "all",
        situation: "all",
        department: "all",
        balance: "a_tirar",
      }).map((item) => item.employee.id)
    ).toEqual(["1", "3"]);

    expect(
      filterEmployeesWithBalance(list, {
        search: "",
        status: "all",
        situation: "all",
        department: "all",
        balance: "a_mais",
      }).map((item) => item.employee.id)
    ).toEqual(["9"]);

    expect(
      filterEmployeesWithBalance(list, {
        search: "",
        status: "all",
        situation: "all",
        department: "all",
        balance: "zerado",
      }).map((item) => item.employee.id)
    ).toEqual(["10"]);
  });

  it("filtra por área", () => {
    const result = filterEmployeesWithBalance(all, {
      search: "",
      status: "all",
      situation: "all",
      department: "Recuperação de Crédito",
    });
    expect(result).toHaveLength(0);
  });

  it("Operações Legais engloba Marketing, Financeiro, Facilities, Limpeza e RH", () => {
    const marketing = row(
      makeEmployee({
        id: "4",
        full_name: "Pessoa Marketing",
        department: "Marketing",
      })
    );
    const rh = row(
      makeEmployee({
        id: "5",
        full_name: "Pessoa RH",
        department: "R.H.",
      })
    );
    const limpeza = row(
      makeEmployee({
        id: "6",
        full_name: "Pessoa Limpeza",
        department: "Limpeza",
      })
    );
    const result = filterEmployeesWithBalance(
      [felipe, andressa, samuel, marketing, rh, limpeza],
      {
        search: "",
        status: "all",
        situation: "all",
        department: "Operações Legais",
      }
    );
    expect(result.map((item) => item.employee.full_name).sort()).toEqual([
      "Felipe Soares de Camargo",
      "Pessoa Limpeza",
      "Pessoa Marketing",
      "Pessoa RH",
      "Samuel Willian Silva",
      // Andressa está em Recursos Humanos → também entra no agrupamento
      "Andressa da Silva",
    ].sort());
  });

  it("lista áreas agrupando RH/Marketing/Limpeza/etc em Operações Legais", () => {
    const marketing = row(
      makeEmployee({
        id: "4",
        full_name: "Pessoa Marketing",
        department: "Marketing",
      })
    );
    const limpeza = row(
      makeEmployee({
        id: "7",
        full_name: "Pessoa Limpeza",
        department: "Limpeza",
      })
    );
    const reestruturacao = row(
      makeEmployee({
        id: "5",
        full_name: "Pessoa Reestruturação",
        department: "Reestruturação",
      })
    );
    const distressed = row(
      makeEmployee({
        id: "6",
        full_name: "Pessoa Distressed",
        department: "Distressed Deals",
      })
    );
    expect(
      listEmployeeDepartments([
        felipe,
        andressa,
        samuel,
        marketing,
        limpeza,
        reestruturacao,
        distressed,
      ])
    ).toEqual(["Operações Legais", "Reestruturação"]);
  });

  it("busca por nome, área ou cargo", () => {
    expect(
      filterEmployeesWithBalance(all, {
        search: "gerente",
        status: "all",
        situation: "all",
        department: "all",
      })
    ).toHaveLength(1);

    expect(
      filterEmployeesWithBalance(all, {
        search: "recursos",
        status: "all",
        situation: "all",
        department: "all",
      })
    ).toHaveLength(1);

    expect(
      filterEmployeesWithBalance(all, {
        search: "xyz",
        status: "all",
        situation: "all",
        department: "all",
      })
    ).toHaveLength(0);
  });
});

describe("resolveCanonicalAreaLabel", () => {
  it("renomeia Insolvência para Reestruturação", () => {
    expect(resolveCanonicalAreaLabel("Insolvência")).toBe("Reestruturação");
    expect(resolveCanonicalAreaLabel("insolvencia")).toBe("Reestruturação");
  });

  it("agrupa áreas administrativas em Operações Legais", () => {
    for (const area of [
      "Financeiro",
      "Facilities",
      "Administrativo",
      "Administração",
      "Recepção",
      "Limpeza",
      "Comercial",
    ]) {
      expect(resolveCanonicalAreaLabel(area)).toBe("Operações Legais");
    }
  });
});

describe("computeFeriasKpis", () => {
  it("ignora ex-colaboradores nos alertas", () => {
    const kpis = computeFeriasKpis([felipe, andressa, samuel]);
    expect(kpis.activeCount).toBe(2);
    expect(kpis.pendingDays).toBe(81);
    expect(kpis.overdue).toBe(0);
    expect(kpis.dueSoon).toBe(1); // Felipe com dueToday/dueSoon conta no alerta
    expect(kpis.onLeave).toBe(1);
  });

  it("conta vencidos só entre ativos", () => {
    const activeOverdue = row(
      makeEmployee({ id: "4", full_name: "Ativo Vencido" }),
      { status: "vencido", pendingDays: 5, overdueDays: 5, dueTodayDays: 0, dueSoonDays: 0, onTimeDays: 0 }
    );
    const kpis = computeFeriasKpis([andressa, activeOverdue]);
    expect(kpis.overdue).toBe(1);
    expect(kpis.pendingDays).toBe(5);
  });
});

describe("getInitials", () => {
  it("pega as duas primeiras letras do nome", () => {
    expect(getInitials("Felipe Soares de Camargo")).toBe("FS");
    expect(getInitials("Andressa")).toBe("A");
  });
});

describe("resolveEmployeeAvatarUrl", () => {
  it("prefere avatar_url público", () => {
    expect(
      resolveEmployeeAvatarUrl("https://cdn/foto.jpg", "https://onedrive/foto.jpg")
    ).toBe("https://cdn/foto.jpg");
  });

  it("usa OneDrive quando não há avatar público", () => {
    expect(resolveEmployeeAvatarUrl(null, "https://onedrive/foto.jpg")).toBe(
      "https://onedrive/foto.jpg"
    );
  });

  it("retorna null quando não há foto", () => {
    expect(resolveEmployeeAvatarUrl("  ", null)).toBeNull();
    expect(resolveEmployeeAvatarUrl(null, null)).toBeNull();
  });
});

describe("employeeEligibleForRecess", () => {
  const recess = { start_date: "2025-12-20", end_date: "2026-01-06" };

  it("aceita ativo admitido antes do recesso", () => {
    expect(
      employeeEligibleForRecess(
        { admission_date: "2020-08-05", termination_date: null, is_active: true },
        recess
      )
    ).toBe(true);
  });

  it("recusa inativo, admitido depois do fim ou desligado antes do início", () => {
    expect(
      employeeEligibleForRecess(
        { admission_date: "2020-08-05", termination_date: null, is_active: false },
        recess
      )
    ).toBe(false);
    expect(
      employeeEligibleForRecess(
        { admission_date: "2026-02-01", termination_date: null, is_active: true },
        recess
      )
    ).toBe(false);
    expect(
      employeeEligibleForRecess(
        { admission_date: "2020-08-05", termination_date: "2025-11-30", is_active: true },
        recess
      )
    ).toBe(false);
  });
});

describe("dateRangesOverlap", () => {
  it("detecta sobreposição parcial e identidade", () => {
    expect(
      dateRangesOverlap(
        { start_date: "2024-12-20", end_date: "2025-01-06" },
        { start_date: "2024-12-20", end_date: "2025-01-05" }
      )
    ).toBe(true);
    expect(
      dateRangesOverlap(
        { start_date: "2024-12-20", end_date: "2025-01-06" },
        { start_date: "2024-12-20", end_date: "2025-01-06" }
      )
    ).toBe(true);
  });

  it("recusa intervalos encostados sem cruzar", () => {
    expect(
      dateRangesOverlap(
        { start_date: "2024-12-20", end_date: "2025-01-06" },
        { start_date: "2025-01-07", end_date: "2025-01-10" }
      )
    ).toBe(false);
  });
});

describe("summarizeRecessApplication", () => {
  const recess = { start_date: "2025-12-20", end_date: "2026-01-06" };
  const employees = [
    {
      id: "a",
      admission_date: "2020-01-01",
      termination_date: null,
      is_active: true,
    },
    {
      id: "b",
      admission_date: "2021-01-01",
      termination_date: null,
      is_active: true,
    },
    {
      id: "c",
      admission_date: "2026-02-01",
      termination_date: null,
      is_active: true,
    },
  ];

  it("marca como pendente quando ninguém tem o lançamento", () => {
    expect(
      summarizeRecessApplication({
        activeEmployees: employees,
        recess,
        appliedEmployeeIds: [],
      })
    ).toEqual({
      eligible: 2,
      applied: 0,
      pending: 2,
      ineligible: 1,
      state: "pendente",
    });
  });

  it("marca como aplicado quando todos os elegíveis já têm", () => {
    expect(
      summarizeRecessApplication({
        activeEmployees: employees,
        recess,
        appliedEmployeeIds: ["a", "b"],
      }).state
    ).toBe("aplicado");
  });

  it("marca como parcial quando só parte já tem", () => {
    expect(
      summarizeRecessApplication({
        activeEmployees: employees,
        recess,
        appliedEmployeeIds: ["a"],
      })
    ).toMatchObject({
      applied: 1,
      pending: 1,
      state: "parcial",
    });
  });

  it("marca sem elegíveis quando ninguém se qualifica", () => {
    expect(
      summarizeRecessApplication({
        activeEmployees: [employees[2]],
        recess,
        appliedEmployeeIds: [],
      }).state
    ).toBe("sem_elegiveis");
  });
});
