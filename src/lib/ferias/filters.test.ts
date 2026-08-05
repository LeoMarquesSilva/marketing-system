import { describe, expect, it } from "vitest";
import {
  computeFeriasKpis,
  employeeEligibleForRecess,
  filterEmployeesWithBalance,
  getInitials,
  resolveEmployeeAvatarUrl,
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

describe("filterEmployeesWithBalance", () => {
  const all = [felipe, andressa, samuel];

  it("por padrão lista só ativos", () => {
    const result = filterEmployeesWithBalance(all, {
      search: "",
      status: "all",
      situation: "ativos",
    });
    expect(result.map((item) => item.employee.id)).toEqual(["1", "3"]);
  });

  it("filtra ex-colaboradores", () => {
    const result = filterEmployeesWithBalance(all, {
      search: "",
      status: "all",
      situation: "inativos",
    });
    expect(result).toHaveLength(1);
    expect(result[0].employee.full_name).toBe("Andressa da Silva");
  });

  it("filtra por status do saldo", () => {
    const result = filterEmployeesWithBalance(all, {
      search: "",
      status: "a_vencer",
      situation: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0].employee.id).toBe("1");
  });

  it("busca por nome, área ou cargo", () => {
    expect(
      filterEmployeesWithBalance(all, {
        search: "gerente",
        status: "all",
        situation: "all",
      })
    ).toHaveLength(1);

    expect(
      filterEmployeesWithBalance(all, {
        search: "recursos",
        status: "all",
        situation: "all",
      })
    ).toHaveLength(1);

    expect(
      filterEmployeesWithBalance(all, {
        search: "xyz",
        status: "all",
        situation: "all",
      })
    ).toHaveLength(0);
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
