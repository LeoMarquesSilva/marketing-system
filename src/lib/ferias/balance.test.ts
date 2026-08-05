import { describe, expect, it } from "vitest";
import {
  computeEmployeeBalance,
  currentAccrualPeriod,
  generateAccrualPeriods,
  inclusiveDayCount,
} from "@/lib/ferias/balance";
import type { VacationLeave, VacationPeriod } from "@/lib/ferias/types";

const ADMISSION = "2020-08-05";
const REFERENCE = "2026-08-04";

function buildPeriods(): VacationPeriod[] {
  return generateAccrualPeriods(ADMISSION, REFERENCE).map((period, index) => ({
    id: `period-${index + 1}`,
    employee_id: "felipe",
    notes: null,
    ...period,
  }));
}

/** Gozos da ficha do Felipe Camargo (129 dias no total). */
function buildLeaves(): VacationLeave[] {
  const rows: Array<[string, string, number, VacationLeave["kind"]]> = [
    ["2020-12-22", "2021-01-03", 13, "recesso"],
    ["2021-12-17", "2022-01-15", 30, "recesso"],
    ["2022-12-20", "2023-01-08", 20, "recesso"],
    ["2023-10-09", "2023-10-13", 5, "ferias"],
    ["2023-12-20", "2024-01-07", 19, "recesso"],
    ["2024-12-20", "2025-01-05", 17, "recesso"],
    ["2025-12-03", "2025-12-09", 7, "ferias"],
    ["2025-12-20", "2026-01-06", 18, "recesso"],
  ];
  return rows.map(([start_date, end_date, days, kind], index) => ({
    id: `leave-${index + 1}`,
    employee_id: "felipe",
    start_date,
    end_date,
    days,
    kind,
    notes: null,
  }));
}

describe("generateAccrualPeriods", () => {
  it("gera um período por ano completo desde a admissão", () => {
    const periods = generateAccrualPeriods(ADMISSION, REFERENCE);
    expect(periods).toHaveLength(6);
    expect(periods[0]).toMatchObject({
      period_start: "2020-08-05",
      period_end: "2021-08-04",
      concessive_start: "2021-08-05",
      concessive_end: "2022-08-04",
      entitled_days: 30,
    });
    expect(periods[5]).toMatchObject({
      period_start: "2025-08-05",
      period_end: "2026-08-04",
      concessive_end: "2027-08-04",
    });
  });

  it("não conta o período aquisitivo ainda em curso", () => {
    expect(generateAccrualPeriods(ADMISSION, "2026-08-03")).toHaveLength(5);
  });

  it("não gera períodos antes do primeiro aniversário de admissão", () => {
    expect(generateAccrualPeriods(ADMISSION, "2021-08-03")).toHaveLength(0);
  });
});

describe("currentAccrualPeriod", () => {
  it("acumula 2,5 dias por mês trabalhado no período em curso", () => {
    const current = currentAccrualPeriod(ADMISSION, "2026-12-05");
    expect(current).toMatchObject({
      periodStart: "2026-08-05",
      periodEnd: "2027-08-04",
      accruedDays: 10,
    });
  });

  it("é nulo quando o período em curso ainda não começou", () => {
    expect(currentAccrualPeriod(ADMISSION, REFERENCE)).toBeNull();
  });
});

describe("computeEmployeeBalance", () => {
  const balance = computeEmployeeBalance({
    admissionDate: ADMISSION,
    periods: buildPeriods(),
    leaves: buildLeaves(),
    referenceDate: REFERENCE,
  });

  it("reproduz o resumo da ficha do Felipe: 180 adquiridos, 129 gozados, 51 pendentes", () => {
    expect(balance.totalEntitledDays).toBe(180);
    expect(balance.totalTakenDays).toBe(129);
    expect(balance.pendingDays).toBe(51);
    expect(balance.unallocatedDays).toBe(0);
  });

  it("consome os gozos em FIFO, deixando o saldo nos períodos mais recentes", () => {
    const remaining = balance.periods.map((item) => item.remainingDays);
    expect(remaining).toEqual([0, 0, 0, 0, 21, 30]);
  });

  it("divide um gozo entre dois períodos quando ele ultrapassa o direito", () => {
    const [first, second] = balance.periods;
    expect(first.allocations.map((item) => item.days)).toEqual([13, 17]);
    expect(second.allocations[0]).toMatchObject({ days: 13 });
  });

  it("classifica o período cujo prazo concessivo está próximo como a vencer", () => {
    expect(balance.periods[4].status).toBe("a_vencer");
    expect(balance.periods[5].status).toBe("em_dia");
    expect(balance.status).toBe("a_vencer");
    // Em 04/08/2026 o concessivo do período 2024/25 encerra hoje: ainda não é "vencido".
    expect(balance.dueTodayDays).toBe(21);
    expect(balance.dueSoonDays).toBe(0);
    expect(balance.onTimeDays).toBe(30);
    expect(balance.overdueDays).toBe(0);
    expect(balance.pendingDays).toBe(51);
  });

  it("marca como vencido o período cujo prazo concessivo já passou", () => {
    const later = computeEmployeeBalance({
      admissionDate: ADMISSION,
      periods: buildPeriods(),
      leaves: buildLeaves(),
      referenceDate: "2026-09-01",
    });
    expect(later.periods[4].status).toBe("vencido");
    expect(later.overdueDays).toBe(21);
    expect(later.status).toBe("vencido");
  });

  it("identifica quem está de férias na data de referência", () => {
    const duringRecess = computeEmployeeBalance({
      admissionDate: ADMISSION,
      periods: buildPeriods(),
      leaves: buildLeaves(),
      referenceDate: "2025-12-26",
    });
    expect(duringRecess.onLeaveNow?.start_date).toBe("2025-12-20");
    expect(balance.onLeaveNow).toBeNull();
  });

  it("acusa dias gozados além do direito adquirido", () => {
    const excess = computeEmployeeBalance({
      admissionDate: ADMISSION,
      periods: buildPeriods().slice(0, 1),
      leaves: buildLeaves().slice(0, 2),
      referenceDate: REFERENCE,
    });
    expect(excess.unallocatedDays).toBe(13);
    expect(excess.pendingDays).toBe(-13);
  });
});

describe("inclusiveDayCount", () => {
  it("conta as duas pontas do intervalo", () => {
    expect(inclusiveDayCount("2025-12-20", "2026-01-06")).toBe(18);
    expect(inclusiveDayCount("2023-10-09", "2023-10-13")).toBe(5);
  });
});
