import { describe, expect, it } from "vitest";
import { aiValuesSchema, defaultValues, describeFields, normalizeValues, valuesToLines, type StudioField } from "./fields";

const fields: StudioField[] = [
  { kind: "texto", key: "titulo", label: "Título", max: 10 },
  { kind: "texto", key: "apoio", label: "Apoio", max: 40, multilinha: true },
  { kind: "alternar", key: "arraste", label: "Arraste", padrao: true },
  { kind: "opcao", key: "lado", label: "Lado", padrao: "esq", opcoes: [{ value: "esq", label: "Esquerda" }, { value: "dir", label: "Direita" }] },
  {
    kind: "lista",
    key: "palcos",
    label: "Palcos",
    item: "Palco",
    min: 1,
    max: 2,
    campos: [
      { kind: "texto", key: "rotulo", label: "Rótulo", max: 8 },
      { kind: "texto", key: "titulo", label: "Painel", max: 20 },
    ],
  },
];

describe("campos do Estúdio", () => {
  it("gera valores-padrão com o mínimo de itens da lista", () => {
    expect(defaultValues(fields)).toEqual({
      titulo: "",
      apoio: "",
      arraste: true,
      lado: "esq",
      palcos: [{ rotulo: "", titulo: "" }],
    });
  });

  it("normaliza o que vem do banco ou da IA: limites, tipos, opções e tamanho da lista", () => {
    const values = normalizeValues(fields, {
      titulo: "UM TÍTULO MUITO LONGO",
      apoio: "linha 1\r\nlinha 2",
      arraste: "sim",
      lado: "cima",
      palcos: [{ rotulo: "Palco 1", titulo: "A" }, { rotulo: "Palco 2" }, { rotulo: "Palco 3" }],
      extra: "ignorado",
    });
    expect(values).toEqual({
      titulo: "UM TÍTULO ",
      apoio: "linha 1\nlinha 2",
      arraste: true,
      lado: "esq",
      palcos: [
        { rotulo: "Palco 1", titulo: "A" },
        { rotulo: "Palco 2", titulo: "" },
      ],
    });
  });

  it("junta linhas em campo de uma linha só", () => {
    expect(normalizeValues(fields, { titulo: "A\n B" }).titulo).toBe("A B");
  });

  it("schema da IA aceita valores completos e recusa tipo errado", () => {
    const schema = aiValuesSchema(fields);
    expect(schema.safeParse({ titulo: "x", apoio: "", arraste: false, lado: "dir", palcos: [{ rotulo: "P", titulo: "T" }] }).success).toBe(true);
    expect(schema.safeParse({ titulo: "x", apoio: "", arraste: "não", lado: "dir", palcos: [] }).success).toBe(false);
  });

  it("descreve os campos para o prompt e monta as linhas do checklist", () => {
    expect(describeFields(fields)).toContain("- palcos (lista de 1 a 2 palcos: rotulo (até 8), titulo (até 20))");
    expect(
      valuesToLines(fields, { titulo: "OI", apoio: " ", arraste: true, lado: "esq", palcos: [{ rotulo: "Palco 1", titulo: "Crédito" }, { rotulo: "", titulo: "" }] })
    ).toEqual(["Título: OI", "Palco: Palco 1 — Crédito"]);
  });
});
