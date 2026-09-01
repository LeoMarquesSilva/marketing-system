import { describe, expect, it } from "vitest";
import { assessEditorialHistory } from "@/lib/gustavo-content/history";

describe("assessEditorialHistory", () => {
  it("marca risco alto quando o mesmo tema/tese já foi usado pelo mesmo ângulo", () => {
    const result = assessEditorialHistory(
      {
        title: "GPA anuncia reestruturação de dívida",
        thesisId: "tese-1",
        angleType: "strategy",
        companies: ["GPA"],
      },
      [
        {
          title: "GPA anuncia reestruturação - Valor",
          thesis_id: "tese-1",
          selected_angle: { type: "strategy" },
          source_context: { companies: ["GPA"] },
          created_at: "2026-08-01T00:00:00.000Z",
        },
      ]
    );
    expect(result.similarityRisk).toBe("high");
    expect(result.similarItems.length).toBeGreaterThan(0);
  });

  it("mantém risco baixo sem histórico parecido", () => {
    const result = assessEditorialHistory(
      {
        title: "Chapter 11 de empresa brasileira nos EUA",
        thesisId: "tese-2",
        angleType: "opinion",
        companies: ["Latam"],
      },
      [
        {
          title: "GPA consegue adesão de credores",
          thesis_id: "tese-1",
          selected_angle: { type: "diagnosis" },
          source_context: { companies: ["GPA"] },
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ]
    );
    expect(result.similarityRisk).toBe("low");
  });
});
