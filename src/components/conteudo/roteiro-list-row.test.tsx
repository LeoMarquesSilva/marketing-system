import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoteiroListRow, splitNewsTitle } from "./roteiro-list-row";
import type { RoteiroItem } from "./roteiro-card";

const base: RoteiroItem = {
  id: "r1",
  topic_id: "t1",
  title: "Justiça autoriza processamento de recuperação judicial do Grupo Casas Bahia - TJSP",
  link: "https://exemplo.com/casas-bahia",
  content_snippet: "O TJSP autorizou o processamento.",
  area: "Reestruturação",
  post: "",
  status: "aguardando_aprovacao",
  published_at: "2026-11-16T10:00:00.000Z",
  created_at: "2026-11-16T10:00:00.000Z",
};

function render(roteiro: RoteiroItem) {
  return renderToStaticMarkup(<RoteiroListRow roteiro={roteiro} onView={() => {}} />);
}

describe("linha da lista de Posts", () => {
  it("separa a manchete do veículo", () => {
    expect(splitNewsTitle(base.title)).toEqual({
      headline: "Justiça autoriza processamento de recuperação judicial do Grupo Casas Bahia",
      source: "TJSP",
    });
  });

  it("mostra o desdobramento com a data do nosso post", () => {
    const html = render({
      ...base,
      related_kind: "desdobramento",
      related_note: "O TJSP autorizou o processamento depois do pedido.",
      related_ref: { source: "instagram", id: "p1", title: "Casas Bahia em recuperação judicial", url: null, date: "2026-08-21T15:00:00.000Z" },
      relevance_score: 9,
    });
    expect(html).toContain("Desdobramento de post de 21/08");
    expect(html).toContain("Potencial 9/10");
  });

  it("avisa quando já falamos do assunto e não mostra nada para assunto novo", () => {
    expect(
      render({
        ...base,
        related_kind: "repetido",
        related_ref: { source: "instagram", id: "p2", title: "Fim da escala 6x1", url: null, date: "2026-09-17T15:00:00.000Z" },
      }),
    ).toContain("Já falamos disso em 17/09");
    const novo = render({ ...base, related_kind: "novo", related_ref: null });
    expect(novo).not.toContain("Já falamos");
    expect(novo).not.toContain("Desdobramento");
  });
});
