import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BP_ICONS, STUDIO_TEMPLATES } from "@/lib/estudio/templates";
import { BP_ICON_NAMES } from "./bp";
import { TEMPLATE_COMPONENTS } from "./index";

describe("desenho dos modelos", () => {
  it("todo modelo registrado tem desenho e mostra o texto do exemplo", () => {
    for (const t of STUDIO_TEMPLATES) {
      const Component = TEMPLATE_COMPONENTS[t.id];
      expect(Component, t.id).toBeDefined();
      const html = renderToStaticMarkup(createElement(Component, { valores: t.exemplo, indice: 0, total: 3, tipo: t.usoEm[0] }));
      const titulo = typeof t.exemplo.titulo === "string" ? t.exemplo.titulo : "";
      if (titulo) expect(html, t.id).toContain(titulo.split("\n")[0].replace(/&/g, "&amp;"));
      expect(html, t.id).toContain(`/estudio/${t.tag.toLowerCase()}/`);
    }
  });

  it("slide BP: o último troca o 'arraste' pelo @ no topo e todo ícone da lista tem desenho", () => {
    const conteudo = STUDIO_TEMPLATES.find((t) => t.id === "bp-conteudo")!;
    const render = (indice: number) =>
      renderToStaticMarkup(createElement(TEMPLATE_COMPONENTS["bp-conteudo"], { valores: conteudo.exemplo, indice, total: 4, tipo: "carrossel" }));
    expect(render(1)).toContain("arraste-navy.png");
    expect(render(3)).not.toContain("arraste-navy.png");
    expect(render(3)).toContain("arroba-navy.png");
    const names = BP_ICONS.map((i) => i.value).filter((v) => v !== "nenhum");
    expect(names.filter((n) => !BP_ICON_NAMES.includes(n))).toEqual([]);
  });

  it("carrossel mostra as bolinhas e o post único não", () => {
    const capa = STUDIO_TEMPLATES.find((t) => t.id === "oab-capa")!;
    const carrossel = renderToStaticMarkup(createElement(TEMPLATE_COMPONENTS["oab-capa"], { valores: capa.exemplo, indice: 1, total: 4, tipo: "carrossel" }));
    const post = renderToStaticMarkup(createElement(TEMPLATE_COMPONENTS["oab-capa"], { valores: { ...capa.exemplo, arraste: false }, indice: 0, total: 1, tipo: "feed" }));
    expect(carrossel).toContain("capa.jpg");
    expect(post).toContain("feed.jpg");
    expect((carrossel.match(/aria-hidden="true"><span/g) ?? []).length).toBeGreaterThan(0);
  });
});
