import { describe, expect, it } from "vitest";
import {
  clampScoreBreakdown,
  shouldPersistScore,
  statusFromScore,
} from "@/lib/gustavo-content/score";

describe("statusFromScore", () => {
  it("descarta abaixo de 55", () => {
    expect(statusFromScore(0)).toBeNull();
    expect(statusFromScore(54)).toBeNull();
    expect(shouldPersistScore(54)).toBe(false);
  });

  it("coloca 55–69 no radar", () => {
    expect(statusFromScore(55)).toBe("radar");
    expect(statusFromScore(69)).toBe("radar");
    expect(shouldPersistScore(55)).toBe(true);
  });

  it("coloca 70 ou mais em sugestão", () => {
    expect(statusFromScore(70)).toBe("sugestao");
    expect(statusFromScore(100)).toBe("sugestao");
  });
});

describe("clampScoreBreakdown", () => {
  it("respeita o teto de cada critério e recalcula o total", () => {
    const result = clampScoreBreakdown({
      icpRelevance: 40,
      thesisPotential: 17,
      businessImpact: 14,
      thesisFit: 8,
      freshness: 9,
      differentiation: 7,
      sourceQuality: 6,
    });
    expect(result.breakdown.icpRelevance).toBe(25);
    expect(result.total).toBe(25 + 17 + 14 + 8 + 9 + 7 + 6);
  });
});
