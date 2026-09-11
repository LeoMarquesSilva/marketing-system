import { describe, expect, it } from "vitest";

import {
  buildClassifyPrompt,
  mapTopicAreaToLegalArea,
  parseClassifiedArea,
  validateClassifiedArea,
} from "@/lib/content-classification";

describe("classificação de Recuperação de Crédito", () => {
  it("preserva a área canônica desde o tópico até a resposta classificada", () => {
    expect(mapTopicAreaToLegalArea("Recuperação de Crédito")).toBe(
      "Recuperação de Crédito"
    );
    expect(parseClassifiedArea("Recuperação de Crédito")).toBe(
      "Recuperação de Crédito"
    );
    expect(
      validateClassifiedArea(
        "Recuperação de Crédito",
        "STJ define cobrança de crédito empresarial",
        "A decisão trata da recuperação de valores devidos por empresas."
      )
    ).toEqual({ area: "Recuperação de Crédito", skip: false });
  });

  it("oferece Recuperação de Crédito à IA e usa o tópico como contexto", () => {
    const prompt = buildClassifyPrompt(
      "Novas medidas para recuperar ativos",
      "Empresas avaliam estratégias jurídicas de cobrança.",
      "Recuperação de Crédito"
    );

    expect(prompt).toContain(
      "Recuperação de Crédito — cobrança, execução e recuperação de créditos"
    );
    expect(prompt).toContain(
      'feed RSS configurado para a área "Recuperação de Crédito"'
    );
  });

  it.each([
    "Recuperação judicial",
    "Recuperação extrajudicial",
    "Tema sobre recuperação judicial e credores",
  ])("mantém %s em Reestruturação", (response) => {
    expect(parseClassifiedArea(response)).toBe("Reestruturação");
  });
});
