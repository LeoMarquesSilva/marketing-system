import { describe, expect, it } from "vitest";
import { fieldKey, templateInputSchema, toTemplateDef } from "./dynamic";
import { normalizeSlides } from "./domain";
import { getTemplate, registerDynamic, templatesFor } from "./templates";

const caixaTitulo = {
  key: "titulo",
  tipo: "texto" as const,
  label: "Título",
  x: 100,
  y: 200,
  w: 800,
  h: 200,
  exemplo: "TÍTULO DE EXEMPLO",
  max: 60,
  linhas: 2,
  fonte: { familia: "Estudio Gobold", peso: 400, estilo: "normal" as const },
  tamanho: 80,
  cor: "#d5b071",
  alinhamento: "left" as const,
  caixaAlta: true,
};

const row = { id: "m-bp-teste-ab12", tag: "BP", nome: "Teste", descricao: "Modelo de teste", formato: "feed" as const, uso: ["feed" as const, "carrossel" as const, "stories" as const], fundo: "BP/modelos/1-teste.png", caixas: [caixaTitulo], ativo: true };

describe("modelos criados na tela", () => {
  it("valida o modelo e recusa caixa de texto sem fonte", () => {
    expect(templateInputSchema.safeParse(row).success).toBe(true);
    const semFonte = { ...row, caixas: [{ ...caixaTitulo, fonte: undefined }] };
    expect(templateInputSchema.safeParse(semFonte).success).toBe(false);
    expect(templateInputSchema.safeParse({ ...row, fundo: "../x.png" }).success).toBe(false);
  });

  it("vira modelo do Estúdio com campos, exemplo e uso do formato", () => {
    const def = toTemplateDef(row);
    expect(def.usoEm).toEqual(["feed", "carrossel"]);
    expect(def.campos[0]).toMatchObject({ kind: "texto", key: "titulo", max: 60, multilinha: true });
    expect(def.exemplo).toEqual({ titulo: "TÍTULO DE EXEMPLO" });
    expect(def.layout?.fundo).toBe("BP/modelos/1-teste.png");
  });

  it("registrado, entra na coleção; desativado, sai da escolha mas o slide continua", () => {
    registerDynamic({ colecoes: [], modelos: [toTemplateDef({ ...row, ativo: false })] });
    expect(getTemplate("m-bp-teste-ab12")).not.toBeNull();
    expect(templatesFor("BP", "carrossel").some((t) => t.id === "m-bp-teste-ab12")).toBe(false);
    const slides = normalizeSlides([{ modelo: "m-bp-teste-ab12", valores: { titulo: "OI" } }], "BP", "carrossel");
    expect(slides[0].valores.titulo).toBe("OI");
    registerDynamic({ colecoes: [], modelos: [] });
  });

  it("nome do campo a partir do rótulo", () => {
    expect(fieldKey("Título da notícia", new Set())).toBe("titulo_da_noticia");
    expect(fieldKey("Título", new Set(["titulo"]))).toBe("titulo_2");
    expect(fieldKey("2ª linha", new Set())).toBe("c_2a_linha");
  });
});
