import { describe, expect, it } from "vitest";
import { makeProfileSlug, nextProfileSlugCandidate } from "@/lib/profiles/slug";

describe("makeProfileSlug", () => {
  it("remove acentos e normaliza para minúsculas com hífen", () => {
    expect(makeProfileSlug("Letícia Rodrigues")).toBe("leticia-rodrigues");
  });

  it("normaliza cedilha e caracteres compostos", () => {
    expect(makeProfileSlug("João Gonçalves de Assunção")).toBe("joao-goncalves-de-assuncao");
  });

  it("colapsa espaços e pontuação em um único hífen", () => {
    expect(makeProfileSlug("  Ana   Maria  —  Silva  ")).toBe("ana-maria-silva");
  });

  it("descarta hífens nas pontas", () => {
    expect(makeProfileSlug("--Pedro--")).toBe("pedro");
  });

  it("preserva dígitos", () => {
    expect(makeProfileSlug("Maria Silva 2")).toBe("maria-silva-2");
  });

  it("devolve string vazia quando não sobra nada utilizável", () => {
    expect(makeProfileSlug("   ")).toBe("");
    expect(makeProfileSlug("!!!")).toBe("");
  });

  it("é determinístico para a mesma entrada", () => {
    expect(makeProfileSlug("Letícia Rodrigues")).toBe(makeProfileSlug("Letícia Rodrigues"));
  });
});

describe("nextProfileSlugCandidate", () => {
  it("mantém o slug base quando não há colisão", () => {
    expect(nextProfileSlugCandidate("ana-silva", new Set())).toBe("ana-silva");
  });

  it("usa sufixo numérico determinístico em vez de sobrescrever", () => {
    expect(nextProfileSlugCandidate("ana-silva", new Set(["ana-silva"]))).toBe("ana-silva-2");
    expect(
      nextProfileSlugCandidate("ana-silva", new Set(["ana-silva", "ana-silva-2"]))
    ).toBe("ana-silva-3");
  });
});
