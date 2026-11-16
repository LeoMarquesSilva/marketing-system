import { describe, expect, it } from "vitest";
import { civilKeyFromLabel, civilSealSrc, civilValueOf } from "./civil";

describe("civilValueOf", () => {
  it.each([
    ["Planejamento e Organização", "inteligencia"],
    ["PLANEJAMENTO E ORGANIZAÇÃO", "inteligencia"],
    ["1. Planejamento e organização", "inteligencia"],
    ["Empatia e Escuta Ativa (Nota 2)", "cliente"],
    ["PERSONALIZAÇÃO DE SOLUÇÕES (NOTA: 2)", "cliente"],
    ["BLOCO 1 – INTELIGÊNCIA EMOCIONAL", "valorizacao"],
    ["Curiosidade e Aprendizado Contínuo - Nota 3", "inovacao"],
    ["Foco e Execução Estratégica – Nota 3", "inteligencia"],
    ["AUTONOMIA RESPONSAVEL", "liberdade"],
    ["Gestão de pessoas e Desenvolvimento de talentos", "lideranca"],
  ])("%s → %s", (title, expected) => {
    expect(civilValueOf(title)).toBe(expected);
  });

  it("o valor escrito vale mais que o critério", () => {
    expect(civilValueOf("Cliente no Centro - Responsabilidade e Ownership")).toBe("cliente");
    expect(civilValueOf("Inteligência em resultados - Curiosidade e Desenvolvimento")).toBe("inteligencia");
    expect(civilValueOf("1. INOVAÇÃO (Desenvolvimento Operacional)")).toBe("inovacao");
  });

  it("sem valor nem critério inteiro, não chuta", () => {
    expect(civilValueOf("Comunicação Assertiva e Clareza de Direcionamento")).toBeNull();
    expect(civilValueOf("FOCO E ORGANIZAÇÃO ESTRATÉGICA")).toBeNull();
    expect(civilValueOf("Aprendizado contínuo")).toBeNull();
    expect(civilValueOf("")).toBeNull();
  });
});

describe("selos", () => {
  it("valor com selo do BP Awards; liderança sem selo", () => {
    expect(civilSealSrc("cliente")).toBe("/bp-awards/selo-cliente.webp");
    expect(civilSealSrc("lideranca")).toBeNull();
    expect(civilKeyFromLabel("Valorização das pessoas")).toBe("valorizacao");
    expect(civilKeyFromLabel("qualquer")).toBeNull();
  });
});
