import { describe, expect, it } from "vitest";
import {
  formatReelMonth,
  reelStudioCreateSchema,
  reelStudioUpdateSchema,
} from "./reel-studio";

describe("reel studio schemas", () => {
  it("accepts a monthly production item with recording collaborators", () => {
    const parsed = reelStudioCreateSchema.safeParse({
      production_month: "2026-08-01",
      title: "Riscos no contrato de fornecimento",
      area: "Societário e Contratos",
      original_script: "Este é um roteiro jurídico recebido do advogado com material suficiente para ser revisado e preparado para gravação.",
      collaborator_ids: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    });

    expect(parsed.success).toBe(true);
  });

  it("requires at least one collaborator and a valid month", () => {
    const parsed = reelStudioCreateSchema.safeParse({
      production_month: "2026-08-15",
      title: "Tema válido",
      original_script: "Este é um roteiro jurídico recebido do advogado com material suficiente para ser revisado e preparado para gravação.",
      collaborator_ids: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("only accepts supported production statuses", () => {
    expect(
      reelStudioUpdateSchema.safeParse({
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        status: "teleprompter_ready",
      }).success
    ).toBe(true);
    expect(
      reelStudioUpdateSchema.safeParse({
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        status: "published",
      }).success
    ).toBe(false);
  });
});

describe("formatReelMonth", () => {
  it("formats the production month in Portuguese", () => {
    expect(formatReelMonth("2026-08-01")).toMatch(/agosto.*2026/i);
  });
});
