import { describe, expect, it } from "vitest";
import {
  assessEditorialHistory,
  buildEditorialHistoryPrompt,
} from "@/lib/gustavo-content/history";

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

  it("entrega ao redator o ângulo, hook e trecho concretos do histórico semelhante", () => {
    const assessment = assessEditorialHistory(
      {
        title: "GPA renegocia dívida com credores",
        thesisId: "tese-1",
        angleType: "strategy",
        companies: ["GPA"],
      },
      [
        {
          title: "GPA avança na renegociação da dívida",
          thesis_id: "tese-1",
          selected_angle: { type: "strategy", title: "Negociar antes do caixa acabar" },
          source_context: { companies: ["GPA"] },
          linkedin_post:
            "A reestruturação não começa no protocolo.\n\nEla começa na negociação, quando ainda há margem para evitar o pior.",
          created_at: "2026-08-01T00:00:00.000Z",
        },
      ]
    );

    const prompt = buildEditorialHistoryPrompt(assessment);

    expect(prompt).toContain("Negociar antes do caixa acabar");
    expect(prompt).toContain("Hook anterior: A reestruturação não começa no protocolo.");
    expect(prompt).toContain("A reestruturação não começa no protocolo");
  });

  it("não usa um gancho alternativo nunca aplicado como se fosse a abertura usada", () => {
    const assessment = assessEditorialHistory(
      {
        title: "GPA renegocia dívida com credores",
        thesisId: "tese-1",
        angleType: "strategy",
        companies: ["GPA"],
      },
      [
        {
          title: "GPA avança na renegociação da dívida",
          thesis_id: "tese-1",
          selected_angle: { type: "strategy" },
          source_context: { companies: ["GPA"] },
          linkedin_post: "Abertura de fato publicada, em um único parágrafo.",
          created_at: "2026-08-01T00:00:00.000Z",
        },
      ]
    );

    const prompt = buildEditorialHistoryPrompt(assessment);
    expect(prompt).toContain("Hook anterior: Abertura de fato publicada, em um único parágrafo.");
  });
});
