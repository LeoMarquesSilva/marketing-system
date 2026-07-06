import { describe, expect, it } from "vitest";
import {
  CARGO_OUTRO,
  formatCargoDisplay,
  resolveCargoOption,
  resolveCargoStoredValue,
} from "@/lib/cargo-options";

describe("resolveCargoOption", () => {
  it("mantém opções exatas", () => {
    expect(resolveCargoOption("Gerente")).toBe("Gerente");
    expect(resolveCargoOption("Recursos Humanos")).toBe("Recursos Humanos");
  });

  it("mapeia variações comuns do RD", () => {
    expect(resolveCargoOption("Sócio")).toBe("Sócio(a) / Proprietário(a)");
    expect(resolveCargoOption("SÓCIO")).toBe("Sócio(a) / Proprietário(a)");
    expect(resolveCargoOption("Proprietário")).toBe("Sócio(a) / Proprietário(a)");
    expect(resolveCargoOption("CEO")).toBe("Diretor(a)");
    expect(resolveCargoOption("CEO/Presidente")).toBe("Diretor(a)");
    expect(resolveCargoOption("Diretor Financeiro")).toBe("Diretor(a)");
    expect(resolveCargoOption("Gerente de RH")).toBe("Gerente");
    expect(resolveCargoOption("COORDENADORA CÍVEL")).toBe("Coordenador(a)");
    expect(resolveCargoOption("Analista de RH")).toBe("Recursos Humanos");
    expect(resolveCargoOption("ADVOGADA JUNIOR")).toBe("Jurídico / Compliance");
    expect(resolveCargoOption("ASSISTENTE JURIDICO")).toBe("Assistente / Secretário(a)");
    expect(resolveCargoOption("Financeiro")).toBe("Financeiro");
  });

  it("cai em Outro para cargos sem encaixe", () => {
    expect(resolveCargoOption("ESTAGIARIO")).toBe(CARGO_OUTRO);
    expect(resolveCargoOption("Reclamante")).toBe(CARGO_OUTRO);
    expect(resolveCargoOption("Consultor")).toBe(CARGO_OUTRO);
  });

  it("ignora N/A", () => {
    expect(resolveCargoOption("N/A")).toBe("");
  });
});

describe("resolveCargoStoredValue", () => {
  it("grava opção canônica quando mapeia", () => {
    expect(resolveCargoStoredValue("Sócio")).toBe("Sócio(a) / Proprietário(a)");
    expect(resolveCargoStoredValue("Gerente Geral")).toBe("Gerente");
  });

  it("grava texto original quando é Outro", () => {
    expect(resolveCargoStoredValue("ESTAGIARIO")).toBe("ESTAGIARIO");
    expect(resolveCargoStoredValue("Reclamante")).toBe("Reclamante");
  });
});

describe("formatCargoDisplay", () => {
  it("exibe opção mapeada", () => {
    expect(formatCargoDisplay("Sócio")).toBe("Sócio(a) / Proprietário(a)");
  });

  it("exibe texto original para Outro", () => {
    expect(formatCargoDisplay("Estagiário")).toBe("Estagiário");
  });
});
