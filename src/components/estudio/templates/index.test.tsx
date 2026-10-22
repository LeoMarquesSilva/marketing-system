import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { STUDIO_TEMPLATES } from "@/lib/estudio/templates";
import { TEMPLATE_COMPONENTS } from "./index";

describe("desenho dos modelos", () => {
  it("todo modelo registrado tem desenho e mostra o texto do exemplo", () => {
    for (const t of STUDIO_TEMPLATES) {
      const Component = TEMPLATE_COMPONENTS[t.id];
      expect(Component, t.id).toBeDefined();
      const html = renderToStaticMarkup(createElement(Component, { valores: t.exemplo, indice: 0, total: 3, tipo: t.usoEm[0] }));
      const titulo = typeof t.exemplo.titulo === "string" ? t.exemplo.titulo : "";
      if (titulo) expect(html, t.id).toContain(titulo.split("\n")[0].replace(/&/g, "&amp;"));
      expect(html, t.id).toContain(`/estudio/oab/`);
    }
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
