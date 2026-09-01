import { describe, expect, it } from "vitest";
import {
  debitExceedsAvailableBalance,
  entitledGainedBetween,
  scheduledExceedsBalanceWarning,
  simulateScheduledShortfall,
} from "@/lib/ferias/schedule-balance";

const ADMISSION = "2025-01-27";
const TODAY = "2026-09-01";

describe("entitledGainedBetween", () => {
  it("não conta direito antes do fim do período aquisitivo em curso", () => {
    expect(entitledGainedBetween(ADMISSION, TODAY, "2026-10-01")).toBe(0);
  });

  it("conta 30 dias quando o período em curso fecha até a data", () => {
    expect(entitledGainedBetween(ADMISSION, TODAY, "2027-01-27")).toBe(30);
  });
});

describe("simulateScheduledShortfall", () => {
  it("acusa falta quando 5 dias programados cobrem só 1 de saldo", () => {
    expect(
      simulateScheduledShortfall({
        pendingDays: 1,
        admissionDate: ADMISSION,
        leaves: [{ start_date: "2026-10-10", days: 5 }],
        referenceDate: TODAY,
      })
    ).toBe(4);
  });

  it("não acusa falta se até lá um período novo já tiver sido adquirido", () => {
    expect(
      simulateScheduledShortfall({
        pendingDays: 1,
        admissionDate: ADMISSION,
        leaves: [{ start_date: "2027-02-01", days: 5 }],
        referenceDate: TODAY,
      })
    ).toBe(0);
  });
});

describe("scheduledExceedsBalanceWarning", () => {
  it("avisa saldo insuficiente de forma distinta da dívida já existente", () => {
    expect(
      scheduledExceedsBalanceWarning({
        pendingDays: 1,
        unallocatedDays: 0,
        scheduledDays: 5,
        admissionDate: ADMISSION,
        scheduledLeaves: [{ start_date: "2026-10-10", days: 5 }],
        referenceDate: TODAY,
      })
    ).toBe(
      "Tem 1 dia de saldo e 5 dias programados sem novo direito suficiente até essas datas. Quando o gozo começar, ficará devendo 4 dias."
    );
  });

  it("deixa o aviso de dívida existente cuidar do caso Deve + programado", () => {
    expect(
      scheduledExceedsBalanceWarning({
        pendingDays: -2,
        unallocatedDays: 2,
        scheduledDays: 4,
      })
    ).toBeNull();
  });
});

describe("debitExceedsAvailableBalance", () => {
  it("pede confirmação ao programar mais dias do que o saldo na data", () => {
    const result = debitExceedsAvailableBalance({
      days: 5,
      startDate: "2026-10-10",
      pendingDays: 1,
      admissionDate: ADMISSION,
      referenceDate: TODAY,
    });
    expect(result?.shortfall).toBe(4);
    expect(result?.message).toContain("Confirma mesmo assim?");
  });

  it("não pede confirmação se um período novo fecha antes do gozo", () => {
    expect(
      debitExceedsAvailableBalance({
        days: 5,
        startDate: "2027-02-01",
        pendingDays: 1,
        admissionDate: ADMISSION,
        referenceDate: TODAY,
      })
    ).toBeNull();
  });
});
