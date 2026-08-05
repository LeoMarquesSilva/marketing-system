import { describe, expect, it } from "vitest";
import {
  employeeCreateSchema,
  leaveCreateSchema,
  periodUpdateSchema,
  recessCreateSchema,
} from "@/lib/ferias/validation";

describe("employeeCreateSchema", () => {
  it("aceita colaborador mínimo com admissão", () => {
    const parsed = employeeCreateSchema.safeParse({
      fullName: "Felipe Soares de Camargo",
      admissionDate: "2020-08-05",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita nome curto e admissão inválida", () => {
    expect(employeeCreateSchema.safeParse({ fullName: "A", admissionDate: "2020-08-05" }).success).toBe(
      false
    );
    expect(
      employeeCreateSchema.safeParse({ fullName: "Felipe", admissionDate: "05/08/2020" }).success
    ).toBe(false);
  });

  it("normaliza e-mail vazio para null", () => {
    const parsed = employeeCreateSchema.parse({
      fullName: "Felipe Camargo",
      admissionDate: "2020-08-05",
      email: "",
    });
    expect(parsed.email).toBeNull();
  });
});

describe("leaveCreateSchema", () => {
  it("aceita lançamento válido", () => {
    const parsed = leaveCreateSchema.safeParse({
      employeeId: "54910190-8806-47be-90b7-80e0a91ddae6",
      startDate: "2025-12-20",
      endDate: "2026-01-06",
      days: 18,
      kind: "recesso",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita retorno anterior ao início", () => {
    const parsed = leaveCreateSchema.safeParse({
      employeeId: "54910190-8806-47be-90b7-80e0a91ddae6",
      startDate: "2026-01-06",
      endDate: "2025-12-20",
      days: 18,
    });
    expect(parsed.success).toBe(false);
  });

  it("usa kind ferias por padrão", () => {
    const parsed = leaveCreateSchema.parse({
      employeeId: "54910190-8806-47be-90b7-80e0a91ddae6",
      startDate: "2025-12-03",
      endDate: "2025-12-09",
      days: 7,
    });
    expect(parsed.kind).toBe("ferias");
  });
});

describe("recessCreateSchema", () => {
  it("aceita recesso coletivo do ano", () => {
    const parsed = recessCreateSchema.safeParse({
      year: 2025,
      startDate: "2025-12-20",
      endDate: "2026-01-06",
      days: 18,
      notes: "Recesso",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita ano fora da faixa e intervalo invertido", () => {
    expect(
      recessCreateSchema.safeParse({
        year: 1999,
        startDate: "2025-12-20",
        endDate: "2026-01-06",
        days: 18,
      }).success
    ).toBe(false);

    expect(
      recessCreateSchema.safeParse({
        year: 2025,
        startDate: "2026-01-06",
        endDate: "2025-12-20",
        days: 18,
      }).success
    ).toBe(false);
  });
});

describe("periodUpdateSchema", () => {
  it("aceita faixas do art. 130", () => {
    for (const entitledDays of [30, 24, 18, 12, 0]) {
      expect(periodUpdateSchema.safeParse({ entitledDays }).success).toBe(true);
    }
  });

  it("aceita só observação ou rejeita payload vazio / fora da faixa", () => {
    expect(periodUpdateSchema.safeParse({ notes: "8 faltas" }).success).toBe(true);
    expect(periodUpdateSchema.safeParse({}).success).toBe(false);
    expect(periodUpdateSchema.safeParse({ entitledDays: 31 }).success).toBe(false);
    expect(periodUpdateSchema.safeParse({ entitledDays: -1 }).success).toBe(false);
  });
});
