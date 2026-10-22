import { describe, expect, it } from "vitest";
import { moveItem, nextPieceCode, normalizeSlides, plannerChecklist, plannerTitle, slideFileName, starterSlides, switchSlideTemplate } from "./domain";
import { getTemplate, STUDIO_TEMPLATES, templatesFor } from "./templates";

describe("modelos", () => {
  it("o exemplo de cada modelo cabe nos próprios campos", () => {
    for (const t of STUDIO_TEMPLATES) {
      const slide = normalizeSlides([{ modelo: t.id, valores: t.exemplo }], t.tag, t.usoEm[0])[0];
      expect(slide?.valores, t.id).toEqual(expect.objectContaining(t.exemplo));
    }
  });

  it("separa modelos por tipo de peça", () => {
    expect(templatesFor("OAB", "stories").every((t) => t.formato === "story")).toBe(true);
    expect(templatesFor("OAB", "carrossel").map((t) => t.id)).toContain("oab-programacao");
    expect(templatesFor("OAB", "feed").map((t) => t.id)).not.toContain("oab-programacao");
  });
});

describe("slides", () => {
  it("peça nova começa com capa e programação no carrossel, e capa sem arraste no post", () => {
    expect(starterSlides("OAB", "carrossel").map((s) => s.modelo)).toEqual(["oab-capa", "oab-programacao"]);
    const [post] = starterSlides("OAB", "feed");
    expect(post.modelo).toBe("oab-capa");
    expect(post.valores.arraste).toBe(false);
  });

  it("descarta slides de outro formato e modelos desconhecidos", () => {
    const slides = normalizeSlides(
      [
        { id: "a", modelo: "oab-aviso-story", valores: {} },
        { id: "b", modelo: "nao-existe", valores: {} },
        { id: "c", modelo: "oab-aviso-feed", valores: { titulo: "É HOJE." } },
      ],
      "OAB",
      "feed"
    );
    expect(slides.map((s) => s.id)).toEqual(["c"]);
    expect(slides[0].valores.titulo).toBe("É HOJE.");
  });

  it("limita o post único a uma arte", () => {
    const capa = getTemplate("oab-capa")!;
    expect(normalizeSlides([capa, capa].map(() => ({ modelo: "oab-capa", valores: capa.exemplo })), "OAB", "feed")).toHaveLength(1);
  });

  it("troca de modelo mantém os campos com o mesmo nome", () => {
    const [slide] = normalizeSlides([{ modelo: "oab-capa", valores: { titulo: "MEU TÍTULO.", data: "29 de outubro" } }], "OAB", "carrossel");
    const switched = switchSlideTemplate(slide, getTemplate("oab-lista-feed")!);
    expect(switched.modelo).toBe("oab-lista-feed");
    expect(switched.valores.titulo).toBe("MEU TÍTULO.");
    expect(switched.valores.data).toBe("29 de outubro");
  });

  it("move itens sem sair da lista", () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});

describe("planner", () => {
  const titles = ["[OAB] F01 Feed — Convite", "[OAB] F05 Feed — Registro", "[OAB] C03 Carrossel — Tarde", "[DC] F09 Algo", "Post [OAB] F12"];

  it("sugere o próximo código livre da tag por tipo", () => {
    expect(nextPieceCode(titles, "OAB", "feed")).toBe("F06");
    expect(nextPieceCode(titles, "OAB", "carrossel")).toBe("C04");
    expect(nextPieceCode(titles, "OAB", "stories")).toBe("S01");
  });

  it("monta título e nome dos arquivos no padrão da campanha", () => {
    expect(plannerTitle("OAB", "S11", "stories", "Agradecimento")).toBe("[OAB] S11 Stories — Agradecimento");
    expect(slideFileName("carrossel", 0)).toBe("slide-01.png");
    expect(slideFileName("stories", 9)).toBe("story-10.png");
  });

  it("checklist leva o texto de cada tela e enquete/sticker entre colchetes", () => {
    const [story] = normalizeSlides(
      [{ modelo: "oab-aviso-story", valores: { titulo: "É HOJE.", itens: [{ icone: "local", texto: "Expo Boulevard" }], cta: "", sticker: "Ver programação", enquete: "Manhã / Tarde" } }],
      "OAB",
      "stories"
    );
    expect(plannerChecklist("stories", [story], "ignorada")).toEqual([
      { label: "Tela 1 · texto exato", content: "Título: É HOJE.\nLinha: Expo Boulevard\n[Enquete: Manhã / Tarde]\n[Sticker: Ver programação]" },
      { label: "Legenda para publicação", content: "ignorada" },
    ]);
  });
});
