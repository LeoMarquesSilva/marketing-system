import { describe, expect, it } from "vitest";
import {
  canSubmitForApproval,
  normalizeCompliance,
} from "@/lib/gustavo-content/compliance";

describe("compliance", () => {
  it("exige uma análise atual antes do envio", () => {
    expect(canSubmitForApproval(null)).toBe(false);
    expect(canSubmitForApproval(undefined)).toBe(false);
  });

  it("mostra alerta sem bloquear observação leve", () => {
    const result = normalizeCompliance({
      safe: true,
      flags: ["sensationalism"],
      requiresHumanReview: true,
    });
    expect(result.requiresHumanReview).toBe(true);
    expect(canSubmitForApproval(result)).toBe(true);
  });

  it("impede envio ao Gustavo em flag grave", () => {
    const result = normalizeCompliance({
      safe: false,
      flags: ["promise_of_result", "commercial_cta"],
      requiresHumanReview: true,
    });
    expect(canSubmitForApproval(result)).toBe(false);
  });
});
