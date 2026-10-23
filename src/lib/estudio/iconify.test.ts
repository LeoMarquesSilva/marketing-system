import { describe, expect, it } from "vitest";
import { normalizeValues, parseIconify, type StudioField } from "./fields";
import { iconFromJson, sanitizeIconBody, searchResults } from "./iconify";

describe("sanitizeIconBody", () => {
  it("mantém o desenho e prefixa ids e referências", () => {
    const body = '<mask id="a"><path fill="#fff" d="M0 0h24v24H0z"/></mask><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" mask="url(#a)"/></g>';
    expect(sanitizeIconBody(body, "mdi-x")).toBe(
      '<mask id="mdi-x-a"><path fill="#fff" d="M0 0h24v24H0z"/></mask><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" mask="url(#mdi-x-a)"/></g>'
    );
  });

  it("tira atributos de evento, estilo e links externos", () => {
    expect(sanitizeIconBody('<path d="M1 1" onload="alert(1)" style="x" fill="url(https://mal.com/a)"/>', "p")).toBe('<path d="M1 1"/>');
  });

  it("recusa tags que não são de desenho e texto solto", () => {
    expect(sanitizeIconBody('<script>alert(1)</script>', "p")).toBeNull();
    expect(sanitizeIconBody('<foreignObject><div/></foreignObject>', "p")).toBeNull();
    expect(sanitizeIconBody('<g>oi</g>', "p")).toBeNull();
    expect(sanitizeIconBody('<image href="x.png"/>', "p")).toBeNull();
  });
});

describe("iconFromJson", () => {
  it("lê o ícone, segue apelidos e usa o tamanho do conjunto", () => {
    const json = { prefix: "mdi", width: 24, height: 24, icons: { scale: { body: '<path d="M1 1"/>' } }, aliases: { balance: { parent: "scale" } } };
    expect(iconFromJson(json, "mdi", "balance")).toEqual({ body: '<path d="M1 1"/>', width: 24, height: 24 });
    expect(iconFromJson({ icons: {} }, "mdi", "nada")).toBeNull();
  });
});

describe("searchResults", () => {
  it("deixa só os conjuntos liberados", () => {
    expect(searchResults({ icons: ["lucide:scale", "fa:scale", "mdi:scale-balance", 3, "ph:x y"] })).toEqual(["lucide:scale", "mdi:scale-balance"]);
  });
});

describe("campo de ícone", () => {
  const campos: StudioField[] = [
    { kind: "icone", key: "icone", label: "Ícone", padrao: "nenhum", opcoes: [{ value: "nenhum", label: "Sem" }, { value: "check", label: "Check" }] },
  ];

  it("aceita atalho ou ícone da Iconify de conjunto liberado", () => {
    expect(normalizeValues(campos, { icone: "check" }).icone).toBe("check");
    expect(normalizeValues(campos, { icone: "iconify:lucide:scale" }).icone).toBe("iconify:lucide:scale");
    expect(normalizeValues(campos, { icone: "iconify:fa:scale" }).icone).toBe("nenhum");
    expect(normalizeValues(campos, { icone: "iconify:lucide:../x" }).icone).toBe("nenhum");
    expect(normalizeValues(campos, { icone: 3 }).icone).toBe("nenhum");
  });

  it("parseIconify separa prefixo e nome", () => {
    expect(parseIconify("iconify:material-symbols:gavel-rounded")).toEqual({ prefix: "material-symbols", name: "gavel-rounded" });
    expect(parseIconify("lucide:scale")).toBeNull();
  });
});
