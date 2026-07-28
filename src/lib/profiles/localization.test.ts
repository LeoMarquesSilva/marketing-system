import { describe, expect, it } from "vitest";
import {
  localizeField,
  resolveProfileLocale,
  selectApprovedLocalization,
} from "@/lib/profiles/localization";
import type { ProfessionalProfileLocalization } from "@/lib/profiles/types";

const pt: ProfessionalProfileLocalization = {
  locale: "pt-BR",
  isApproved: true,
  displayName: "Letícia Rodrigues",
  role: "Sócia",
  practiceArea: "Tributário",
  tagline: "A advocacia começa pela escuta.",
  bio: "Atua em contencioso tributário.",
};

const en: ProfessionalProfileLocalization = {
  locale: "en",
  isApproved: true,
  displayName: "Leticia Rodrigues",
  role: "Partner",
  practiceArea: "Tax",
  tagline: "Advocacy begins with listening.",
  bio: "Works in tax litigation.",
};

describe("resolveProfileLocale", () => {
  it("aceita variantes regionais de inglês", () => {
    expect(resolveProfileLocale("en-US")).toBe("en");
    expect(resolveProfileLocale("en")).toBe("en");
    expect(resolveProfileLocale("EN-gb")).toBe("en");
  });

  it("mapeia português para pt-BR", () => {
    expect(resolveProfileLocale("pt")).toBe("pt-BR");
    expect(resolveProfileLocale("pt-BR")).toBe("pt-BR");
    expect(resolveProfileLocale("pt-PT")).toBe("pt-BR");
  });

  it("usa pt-BR para ausente ou não suportado", () => {
    expect(resolveProfileLocale(null)).toBe("pt-BR");
    expect(resolveProfileLocale(undefined)).toBe("pt-BR");
    expect(resolveProfileLocale("")).toBe("pt-BR");
    expect(resolveProfileLocale("es")).toBe("pt-BR");
    expect(resolveProfileLocale("klingon")).toBe("pt-BR");
  });
});

describe("localizeField", () => {
  it("cai para pt-BR quando o valor em inglês está vazio", () => {
    expect(localizeField({ en: "", "pt-BR": "Sócia" }, "en")).toBe("Sócia");
  });

  it("cai para pt-BR quando o valor em inglês é só espaço em branco", () => {
    expect(localizeField({ en: "   ", "pt-BR": "Sócia" }, "en")).toBe("Sócia");
  });

  it("cai para pt-BR quando o valor em inglês é nulo", () => {
    expect(localizeField({ en: null, "pt-BR": "Sócia" }, "en")).toBe("Sócia");
  });

  it("usa o valor em inglês quando ele existe", () => {
    expect(localizeField({ en: "Partner", "pt-BR": "Sócia" }, "en")).toBe("Partner");
  });

  it("nunca cai de pt-BR para inglês", () => {
    expect(localizeField({ en: "Partner", "pt-BR": "" }, "pt-BR")).toBe("");
  });

  it("devolve string vazia quando nenhum idioma tem valor", () => {
    expect(localizeField({ en: null, "pt-BR": null }, "en")).toBe("");
  });
});

describe("selectApprovedLocalization", () => {
  it("cai inteiramente para PT quando o inglês não está aprovado", () => {
    const result = selectApprovedLocalization(pt, { ...en, isApproved: false }, "en");
    expect(result).toBe(pt);
  });

  it("usa o inglês aprovado quando pedido", () => {
    expect(selectApprovedLocalization(pt, en, "en")).toBe(en);
  });

  it("cai para PT quando não existe registro em inglês", () => {
    expect(selectApprovedLocalization(pt, null, "en")).toBe(pt);
  });

  it("sempre devolve PT quando o idioma pedido é pt-BR", () => {
    expect(selectApprovedLocalization(pt, en, "pt-BR")).toBe(pt);
  });
});
