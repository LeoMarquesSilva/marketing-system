import { describe, expect, it } from "vitest";
import { canAccessPath, firstAllowedPath, hasCleaningAccess } from "@/lib/access-control";

describe("acesso à limpeza", () => {
  const cristiana = { role: null, permissions: ["/conteudo/roteiros", "/limpeza"] };
  const leticia = { role: null, permissions: ["/eventos", "/facilities"] };
  const advogado = { role: null, permissions: ["/conteudo/roteiros"] };

  it("a equipe da limpeza entra direto na lista do dia e não vê o resto de Facilities", () => {
    expect(firstAllowedPath(cristiana)).toBe("/limpeza");
    expect(canAccessPath(cristiana, "/limpeza")).toBe(true);
    expect(canAccessPath(cristiana, "/facilities/limpeza")).toBe(false);
    expect(canAccessPath(cristiana, "/facilities/fornecedores")).toBe(false);
  });

  it("Facilities confere e também abre a lista do dia", () => {
    expect(hasCleaningAccess(leticia)).toBe(true);
    expect(canAccessPath(leticia, "/facilities/limpeza")).toBe(true);
    expect(canAccessPath(leticia, "/limpeza")).toBe(true);
    expect(firstAllowedPath(leticia)).not.toBe("/limpeza");
  });

  it("quem não é da limpeza nem de Facilities não entra", () => {
    expect(hasCleaningAccess(advogado)).toBe(false);
    expect(canAccessPath(advogado, "/limpeza")).toBe(false);
    expect(hasCleaningAccess({ role: "admin", permissions: null })).toBe(true);
  });
});
