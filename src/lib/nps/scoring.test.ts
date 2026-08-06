import { describe, expect, it } from "vitest";
import {
  averageScore,
  classifyNpsScore,
  computeDimensionAverages,
  computeNpsSummary,
} from "@/lib/nps/scoring";

describe("classifyNpsScore", () => {
  it("classifica promotores, neutros e detratores", () => {
    expect(classifyNpsScore(10)).toBe("promoter");
    expect(classifyNpsScore(9)).toBe("promoter");
    expect(classifyNpsScore(8)).toBe("passive");
    expect(classifyNpsScore(7)).toBe("passive");
    expect(classifyNpsScore(6)).toBe("detractor");
    expect(classifyNpsScore(0)).toBe("detractor");
  });
});

describe("computeNpsSummary", () => {
  it("retorna nps null sem respostas", () => {
    expect(computeNpsSummary([])).toEqual({
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      nps: null,
    });
  });

  it("calcula NPS clássico", () => {
    // 2 promotores, 1 neutro, 1 detrator → (50% - 25%) = 25
    const summary = computeNpsSummary([10, 9, 7, 3]);
    expect(summary).toEqual({
      total: 4,
      promoters: 2,
      passives: 1,
      detractors: 1,
      nps: 25,
    });
  });

  it("NPS 100 quando todos são promotores", () => {
    expect(computeNpsSummary([9, 10, 10]).nps).toBe(100);
  });

  it("NPS -100 quando todos são detratores", () => {
    expect(computeNpsSummary([0, 1, 6]).nps).toBe(-100);
  });
});

describe("averageScore / computeDimensionAverages", () => {
  it("média arredondada em 1 casa", () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([10, 8, 9])).toBe(9);
    expect(averageScore([10, 9])).toBe(9.5);
  });

  it("médias por dimensão", () => {
    const dims = computeDimensionAverages([
      {
        score_recommend: 10,
        score_availability: 8,
        score_communication: 9,
        score_innovation: 7,
        score_technical: 10,
      },
      {
        score_recommend: 8,
        score_availability: 8,
        score_communication: 7,
        score_innovation: 7,
        score_technical: 8,
      },
    ]);
    expect(dims.recommend).toBe(9);
    expect(dims.availability).toBe(8);
    expect(dims.communication).toBe(8);
    expect(dims.innovation).toBe(7);
    expect(dims.technical).toBe(9);
  });
});
