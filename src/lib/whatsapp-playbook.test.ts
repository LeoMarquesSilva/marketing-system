import { describe, expect, it } from "vitest";
import { ATENDIMENTO_AREAS, ATENDIMENTO_MANUAL, ATENDIMENTO_TOM } from "./whatsapp-playbook";

describe("manual de atendimento da IA", () => {
  it("monta o texto inteiro, com tom e áreas dentro", () => {
    expect(ATENDIMENTO_MANUAL).not.toContain("${");
    expect(ATENDIMENTO_MANUAL).toContain(ATENDIMENTO_TOM);
    expect(ATENDIMENTO_MANUAL).toContain(ATENDIMENTO_AREAS);
  });

  it("tem um responsável para cada área do manual", () => {
    for (const area of ["Trabalhista", "Tributário", "Cível", "Recuperação de Crédito", "Contratos", "Reestruturação"]) {
      expect(ATENDIMENTO_AREAS).toMatch(new RegExp(`- ${area} \\(`));
    }
  });
});
