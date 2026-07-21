import { describe, expect, it } from "vitest";
import {
  buildReelWordHtml,
  reelScriptInputSchema,
  type ReelScript,
} from "./reels-script";

const validInput = {
  area_juridica: "Trabalhista",
  tema: "Férias coletivas",
  publico_alvo: "Gestores de recursos humanos",
  texto_original:
    "A empresa pode conceder férias coletivas desde que observe os requisitos legais informados no material revisado pela área jurídica.",
  duracao_desejada_segundos: 60,
};

const script: ReelScript = {
  gancho: "Sua empresa está organizando férias coletivas?",
  desenvolvimento: "A medida exige atenção aos requisitos legais aplicáveis.",
  encerramento: "Analise o caso concreto antes de decidir.",
  roteiro_completo:
    "Sua empresa está organizando férias coletivas? A medida exige atenção aos requisitos legais aplicáveis. Analise o caso concreto antes de decidir.",
  duracao_estimada_segundos: 58,
  pontos_para_validacao_juridica: ["Confirmar o prazo aplicável ao caso."],
  alteracoes_realizadas: ["Redução de repetições."],
};

describe("reelScriptInputSchema", () => {
  it("aceita uma base jurídica completa com os campos opcionais padrão", () => {
    const parsed = reelScriptInputSchema.safeParse(validInput);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.informacoes_obrigatorias).toEqual([]);
      expect(parsed.data.cta_desejado).toContain("link da bio");
    }
  });

  it("rejeita material jurídico curto demais", () => {
    const parsed = reelScriptInputSchema.safeParse({
      ...validInput,
      texto_original: "Texto curto.",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("buildReelWordHtml", () => {
  it("escapa conteúdo do usuário ao gerar o documento Word", () => {
    const html = buildReelWordHtml({
      title: "Férias <coletivas>",
      area: "Trabalhista",
      audience: "RH",
      desiredDuration: 60,
      script,
    });

    expect(html).toContain("Férias &lt;coletivas&gt;");
    expect(html).toContain("Pontos para validação jurídica");
    expect(html).toContain("Redução de repetições.");
  });
});
