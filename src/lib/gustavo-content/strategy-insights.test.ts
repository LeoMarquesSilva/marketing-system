import { describe, expect, it } from "vitest";
import {
  matchThesesToPillar,
  pillarsMissingTheses,
  strategyOperatingPulse,
} from "@/lib/gustavo-content/strategy-insights";
import type { GustavoThesis } from "@/lib/gustavo-content/theses";

function thesis(partial: Partial<GustavoThesis>): GustavoThesis {
  return {
    id: partial.id ?? "t1",
    title: partial.title ?? "Tese",
    thesis: partial.thesis ?? "",
    explanation: null,
    business_importance: null,
    counterpoint: null,
    applications: [],
    tags: partial.tags ?? [],
    conviction: "strong",
    status: partial.status ?? "validated",
    gustavo_phrases: [],
    usage_count: partial.usage_count ?? 0,
    last_used_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

describe("strategy-insights", () => {
  it("liga teses ao pilar pelo território semântico", () => {
    const matched = matchThesesToPillar(
      {
        title: "Decisões sob pressão",
        description: "Trade-offs de caixa, dívida e credores.",
        reason: "",
      },
      [
        thesis({
          id: "a",
          title: "Dívida sem caixa é decisão, não destino",
          thesis: "A pressão de credores antecipa escolhas de preservação.",
          tags: ["dívida", "caixa"],
        }),
        thesis({
          id: "b",
          title: "Honorários em recuperação",
          thesis: "Discussão processual sem leitura empresarial.",
          tags: ["honorários"],
        }),
      ]
    );

    expect(matched.map((item) => item.id)).toEqual(["a"]);
  });

  it("aponta pilares ainda sem tese de apoio", () => {
    const missing = pillarsMissingTheses(
      [
        { title: "Preservação de valor", description: "Tempo e negociação.", reason: "" },
        { title: "Crise antes do processo", description: "Sinais de liquidez.", reason: "" },
      ],
      [
        thesis({
          title: "Liquidez some antes do pedido",
          thesis: "A crise aparece no caixa.",
          tags: ["liquidez", "crise"],
        }),
      ]
    );

    expect(missing).toEqual(["Preservação de valor"]);
  });

  it("resume o pulso operacional da estratégia", () => {
    const pulse = strategyOperatingPulse({
      theses: [
        thesis({ status: "validated" }),
        thesis({ id: "t2", status: "pending" }),
        thesis({ id: "t3", status: "disabled" }),
      ],
      voice: [
        {
          id: "v1",
          source_type: "linkedin",
          source_url: null,
          published_at: null,
          original_text: "texto",
          content_type: null,
          tone: null,
          analysis: null,
          performance: null,
          authenticity: "gustavo_original",
          is_active: true,
          created_by: null,
          created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z",
        },
      ],
      items: [],
    });

    expect(pulse.validatedTheses).toBe(1);
    expect(pulse.pendingTheses).toBe(1);
    expect(pulse.voiceSamples).toBe(1);
  });
});
