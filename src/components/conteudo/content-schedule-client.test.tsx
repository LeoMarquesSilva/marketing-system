import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AreaMark, CollaboratorAvatar, SlotRow } from "./content-schedule-client";

describe("SlotRow", () => {
  it("exibe publicação e métricas de histórico mesmo sem conteúdo vinculado", () => {
    const html = renderToStaticMarkup(
      <SlotRow
        slot={{
          id: "slot-1",
          area: "Tributário",
          date: "2026-09-18",
          format: "post",
          status: "published",
          imported: true,
          sourceName: "Nome da planilha",
          sourceStatus: "Concluída",
          publication: {
            id: "post-1",
            permalink: "https://www.instagram.com/p/example/",
            reach: 1234,
            likes: 87,
            comments: 6,
          },
        }}
        collaborators={[]}
        canAssign={false}
        canManage={false}
        saving={false}
        onAssign={() => undefined}
        onEdit={() => undefined}
      />
    );

    expect(html).toContain("Ver publicação");
    expect(html).toContain("1,2 mil alcance");
    expect(html).toContain("87 curtidas");
    expect(html).toContain("Nome da planilha");
    expect(html).not.toContain("Aguardando escolha");
  });
});

describe("identidade visual do cronograma", () => {
  it("usa iniciais identificáveis enquanto a foto do colaborador não carrega", () => {
    const html = renderToStaticMarkup(
      <CollaboratorAvatar person={{ name: "Marina Oliveira", avatarUrl: "/marina.jpg" }} />
    );
    expect(html).toContain("MO");
    expect(html).toContain("avatar-fallback");
  });

  it("distingue Special Situations com o ícone e a cor da área", () => {
    const html = renderToStaticMarkup(<AreaMark area="Special Situations" />);
    expect(html).toContain("Special Situations");
    expect(html).toContain("lucide-zap");
    expect(html).toContain("bg-orange-100");
  });
});
