import { describe, expect, it } from "vitest";
import { CLEANING_GUIDES, cleaningGuideSteps, isCleaningGuide } from "./cleaning-guide";

describe("guias da limpeza", () => {
  it("usa ids aceitos pela tabela de tours", () => {
    for (const guide of CLEANING_GUIDES) expect(guide).toMatch(/^[a-z0-9-]{3,80}$/);
    expect(isCleaningGuide("limpeza-hoje")).toBe(true);
    expect(isCleaningGuide("vistagem")).toBe(false);
  });

  it("muda a abertura da lista para quem cuida de Facilities", () => {
    const equipe = cleaningGuideSteps("limpeza-hoje", { canManage: false, isAdmin: false });
    const gestao = cleaningGuideSteps("limpeza-hoje", { canManage: true, isAdmin: false });
    expect(equipe[0].title).toBe("Boas-vindas à Limpeza de hoje");
    expect(gestao[0].title).toBe("Esta é a lista da equipe da limpeza");
    expect(equipe.map((s) => s.target)).toEqual([null, "progresso", "ambiente", "nao-deu", "avisar", "encerrar", "ver-guia"]);
  });

  it("explica ao administrador como liberar a equipe em Usuários", () => {
    const admin = cleaningGuideSteps("limpeza-acompanhamento", { canManage: true, isAdmin: true }).find((s) => s.id === "equipe");
    const gestora = cleaningGuideSteps("limpeza-acompanhamento", { canManage: true, isAdmin: false }).find((s) => s.id === "equipe");
    expect(admin?.body).toContain("libere Limpeza de hoje no cadastro dela em Usuários");
    expect(gestora?.body).toContain("peça ao administrador do ORQESTRAI");
  });

  it("todo passo tem título e texto", () => {
    for (const guide of CLEANING_GUIDES) {
      for (const step of cleaningGuideSteps(guide, { canManage: true, isAdmin: true })) {
        expect(step.title.length).toBeGreaterThan(3);
        expect(step.body.length).toBeGreaterThan(20);
      }
    }
  });
});
