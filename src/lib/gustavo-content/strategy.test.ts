import { describe, expect, it } from "vitest";
import {
  buildStrategyPrompt,
  validateStrategyInput,
} from "@/lib/gustavo-content/strategy";

const INPUT = {
  positioning:
    "Ser reconhecido como a referência que traduz crises empresariais em decisões de preservação de valor.",
  editorial_promise:
    "Explicar o que crises e reestruturações revelam sobre empresas.",
  strategic_rationale:
    "Decisores não precisam de mais notícias; precisam entender sinais, riscos e escolhas.",
  icp: ["CEOs", " CFOs ", "", "CEOs"],
  icp_context: "Empresas com faturamento a partir de aproximadamente R$ 5 milhões.",
  content_pillars: [
    {
      title: "Crise como sinal",
      description: "Ler o que aconteceu antes do processo formal.",
      reason: "Ajuda o empresário a reconhecer o problema cedo.",
    },
    { title: "", description: "ignorar", reason: "ignorar" },
  ],
  channel_roles: [
    {
      channel: "LinkedIn",
      role: "Construir autoridade por meio de análises.",
      reason: "É onde decisores consomem leitura empresarial.",
    },
  ],
  editorial_principles: "A notícia é matéria-prima\nO jurídico sustenta a análise",
  avoidances: ["Resumo de notícia", "CTA comercial"],
  success_signals: ["Reconhecimento por decisores", "Conversas estratégicas qualificadas"],
};

describe("estratégia do posicionamento do Gustavo", () => {
  it("normaliza o documento sem duplicar públicos ou manter blocos vazios", () => {
    const result = validateStrategyInput(INPUT);

    expect(result.icp).toEqual(["CEOs", "CFOs"]);
    expect(result.content_pillars).toEqual([INPUT.content_pillars[0]]);
    expect(result.editorial_principles).toEqual([
      "A notícia é matéria-prima",
      "O jurídico sustenta a análise",
    ]);
  });

  it("impede salvar uma estratégia sem posicionamento, razão ou ICP", () => {
    expect(() =>
      validateStrategyInput({
        ...INPUT,
        positioning: " ",
      })
    ).toThrow("posicionamento");

    expect(() => validateStrategyInput({ ...INPUT, icp: [] })).toThrow("ICP");
    expect(() => validateStrategyInput({ ...INPUT, strategic_rationale: "" })).toThrow(
      "razão estratégica"
    );
  });

  it("transforma a estratégia em contexto operacional para a IA", () => {
    const prompt = buildStrategyPrompt(validateStrategyInput(INPUT));

    expect(prompt).toContain("POSICIONAMENTO DESEJADO");
    expect(prompt).toContain("traduz crises empresariais");
    expect(prompt).toContain("CEOs | CFOs");
    expect(prompt).toContain("POR QUE ESSA ESTRATÉGIA EXISTE");
    expect(prompt).toContain("Crise como sinal");
    expect(prompt).toContain("LinkedIn");
    expect(prompt).toContain("EVITAR: Resumo de notícia | CTA comercial");
  });
});
