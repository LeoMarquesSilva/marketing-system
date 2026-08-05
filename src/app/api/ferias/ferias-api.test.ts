import { describe, expect, it } from "vitest";
import { FeriasHttpError, toApiError } from "@/lib/ferias/errors";
import {
  employeeCreateSchema,
  leaveCreateSchema,
  periodUpdateSchema,
  recessCreateSchema,
} from "@/lib/ferias/validation";

/**
 * As rotas de /api/ferias são casca fina: autorizam, validam com Zod e
 * traduzem FeriasHttpError. O contrato estável (status/código) é o que
 * dá para testar sem subir o Next.
 */

describe("toApiError", () => {
  it("preserva status e código do domínio", () => {
    const mapped = toApiError(new FeriasHttpError("Não autenticado.", 401, "UNAUTHENTICATED"));
    expect(mapped.status).toBe(401);
    expect(mapped.body).toEqual({ error: "Não autenticado.", code: "UNAUTHENTICATED" });
  });

  it("mapeia 403 de quem não tem /ferias", () => {
    const mapped = toApiError(
      new FeriasHttpError("Você não tem acesso ao módulo de Férias.", 403, "FORBIDDEN")
    );
    expect(mapped.status).toBe(403);
    expect(mapped.body.code).toBe("FORBIDDEN");
  });

  it("não vaza detalhe interno em erro inesperado", () => {
    const mapped = toApiError(
      new Error("connection to db-primary at 10.0.0.4 failed: password authentication")
    );
    expect(mapped.status).toBe(500);
    expect(mapped.body.code).toBe("INTERNAL_ERROR");
    expect(mapped.body.error).toBe("Ocorreu um erro inesperado.");
    expect(JSON.stringify(mapped)).not.toContain("10.0.0.4");
    expect(JSON.stringify(mapped)).not.toContain("password");
  });
});

describe("contrato de payloads das rotas", () => {
  it("POST /employees exige nome e admissão", () => {
    expect(employeeCreateSchema.safeParse({ fullName: "Felipe" }).success).toBe(false);
    expect(
      employeeCreateSchema.safeParse({
        fullName: "Felipe Camargo",
        admissionDate: "2020-08-05",
      }).success
    ).toBe(true);
  });

  it("POST /leaves exige employeeId e intervalo", () => {
    expect(
      leaveCreateSchema.safeParse({
        startDate: "2025-12-20",
        endDate: "2026-01-06",
        days: 18,
      }).success
    ).toBe(false);
  });

  it("POST /recess aceita ano + datas + dias", () => {
    expect(
      recessCreateSchema.safeParse({
        year: 2026,
        startDate: "2026-12-20",
        endDate: "2027-01-06",
        days: 18,
      }).success
    ).toBe(true);
  });

  it("PATCH /periods exige entitledDays ou notes na faixa 0–30", () => {
    expect(periodUpdateSchema.safeParse({ entitledDays: 24 }).success).toBe(true);
    expect(periodUpdateSchema.safeParse({}).success).toBe(false);
    expect(periodUpdateSchema.safeParse({ entitledDays: 40 }).success).toBe(false);
  });
});
