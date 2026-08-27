import { describe, expect, it } from "vitest";
import {
  loginPathWithReturn,
  resolvePostLoginPathFromProfile,
  sanitizeNextPath,
} from "@/lib/post-login-path";

describe("sanitizeNextPath", () => {
  it("aceita rotas internas com query", () => {
    expect(sanitizeNextPath("/cafe-com-cultura?source=qr")).toBe("/cafe-com-cultura?source=qr");
  });

  it("rejeita destino externo ou o próprio login", () => {
    expect(sanitizeNextPath("https://evil.test/cafe-com-cultura")).toBeNull();
    expect(sanitizeNextPath("//evil.test")).toBeNull();
    expect(sanitizeNextPath("/login?next=/planner")).toBeNull();
  });
});

describe("loginPathWithReturn", () => {
  it("guarda a página de check-in do Café com Cultura", () => {
    expect(loginPathWithReturn("/cafe-com-cultura", "?source=nfc")).toBe(
      "/login?next=%2Fcafe-com-cultura%3Fsource%3Dnfc"
    );
  });

  it("não empilha next quando já está no login", () => {
    expect(loginPathWithReturn("/login", "?next=/cafe-com-cultura")).toBe("/login");
  });
});

describe("resolvePostLoginPathFromProfile", () => {
  it("devolve o colaborador ao check-in depois do login", () => {
    const colaborador = { department: "Cível", role: null, permissions: ["/conteudo/roteiros"] };
    expect(resolvePostLoginPathFromProfile(colaborador, "/cafe-com-cultura?source=qr")).toBe(
      "/cafe-com-cultura?source=qr"
    );
  });

  it("prioriza troca de senha obrigatória", () => {
    expect(
      resolvePostLoginPathFromProfile(
        { must_change_password: true, department: "Cível" },
        "/cafe-com-cultura"
      )
    ).toBe("/alterar-senha");
  });

  it("sem next, gestor/admin cai no dashboard — por isso o next precisa sobreviver", () => {
    expect(resolvePostLoginPathFromProfile({ role: "designer", department: "Operações Legais" })).toBe(
      "/"
    );
    expect(resolvePostLoginPathFromProfile({ role: "admin", department: "Comercial" })).toBe("/");
  });
});
