import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Pe27Board } from "@/lib/pe27/types";
import { Pe27Insumos } from "./insumos-client";

function board(canEdit: boolean): Pe27Board {
  return {
    can_edit: canEdit,
    groups: [],
    conductors: [],
    files: { presentation_url: "/x", groups_sheet_url: "/y" },
    levers: [
      {
        id: "l1",
        dimension: "clientes",
        group_id: "g1",
        position: 1,
        title: "Atendimento personalizado",
        original_title: "Atendimento personalizado",
        transcription_note: null,
        status: "em_analise",
        merged_into: null,
        decision_note: null,
        updated_at: "2026-11-09T12:00:00Z",
        updated_by_name: null,
        goals: [],
      },
    ],
  };
}

describe("insumos do PE27", () => {
  it("admin vê os comandos de decisão e criação", () => {
    const html = renderToStaticMarkup(<Pe27Insumos initialBoard={board(true)} initialDimension="clientes" />);
    expect(html).toContain("Decidir");
    expect(html).toContain("Nova alavanca");
    expect(html).not.toContain("Só leitura");
  });

  it("quem só lê (consultores) não vê criar nem decidir", () => {
    const html = renderToStaticMarkup(<Pe27Insumos initialBoard={board(false)} initialDimension="clientes" />);
    expect(html).toContain("Só leitura");
    expect(html).toContain(">Ver<");
    expect(html).not.toContain("Decidir");
    expect(html).not.toContain("Nova alavanca");
    expect(html).not.toContain(">Meta<");
  });
});
