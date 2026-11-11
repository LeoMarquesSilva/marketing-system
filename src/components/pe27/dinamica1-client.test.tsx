import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Pe27Board, Pe27Group, Pe27Reflection } from "@/lib/pe27/types";
import { Pe27Dinamica1 } from "./dinamica1-client";

function group(id: string, theme: Pe27Group["theme"], extra: Partial<Pe27Group> = {}): Pe27Group {
  return {
    id,
    dynamic: 1,
    dimension: null,
    theme,
    name: `Grupo ${id}`,
    poster_title: null,
    poster_url: `/api/pe27/arquivos?caminho=${id}.jpg`,
    sketch_urls: [],
    proposal: null,
    notes: null,
    members: [],
    ...extra,
  };
}

function item(
  id: string,
  groupId: string,
  direction: Pe27Reflection["direction"],
  text: string,
  extra: Partial<Pe27Reflection> = {},
): Pe27Reflection {
  return {
    id,
    group_id: groupId,
    direction,
    position: 1,
    text,
    detail: null,
    facet: null,
    source: "cartaz",
    transcription_note: null,
    ...extra,
  };
}

const board: Pe27Board = {
  can_edit: false,
  levers: [],
  conductors: [],
  files: { presentation_url: "/x", groups_sheet_url: "/y", dinamica1_groups_sheet_url: "/z" },
  groups: [
    group("missao", "missao", {
      proposal: "Impactar a sociedade por meio dos clientes.",
      members: [
        {
          id: "m1",
          name: "Daniel Pressatto",
          short_name: "Daniel Pressatto",
          avatar_url: null,
          area: "Trabalhista",
          is_area_partner: true,
        },
        {
          id: "m2",
          name: "Samuel Willian",
          short_name: "Samuel Willian",
          avatar_url: null,
          area: "Operações Legais",
          is_area_partner: false,
        },
      ],
    }),
    group("valores", "valores"),
    group("d2", null, { dynamic: 2, dimension: "clientes" }),
  ],
  reflections: [
    item("1", "missao", "aproximou", "Desenvolvimento de pessoas"),
    item("2", "missao", "aproximou", "Composição das equipes", { source: "rascunho" }),
    item("3", "missao", "afastou", "Falha de comunicação", { detail: "Comunicação prejudicada em detrimento do cargo" }),
    item("4", "valores", "aproximou", "NPS", { facet: "C · Cliente no centro" }),
    item("5", "valores", "afastou", "Gestão de prioridades", { facet: "I · Inteligência em resultados" }),
  ],
};

describe("matriz da Dinâmica 1", () => {
  it("mostra os quatro temas nas linhas, com aproximou e afastou de cada grupo", () => {
    const html = renderToStaticMarkup(<Pe27Dinamica1 board={board} />);
    for (const label of ["Visão", "Missão", "Valores", "Propósito", "Aproximou", "Afastou"]) expect(html).toContain(label);
    expect(html).toContain("Desenvolvimento de pessoas");
    expect(html).toContain("só no rascunho");
    expect(html).toContain("No rascunho: Comunicação prejudicada em detrimento do cargo");
    expect(html).toContain("Impactar a sociedade por meio dos clientes.");
    // Integrantes do grupo da Dinâmica 1, com o sócio de área marcado
    expect(html).toContain("Grupo missao · 2 pessoas");
    expect(html).toContain("Trabalhista · Sócio de área");
    expect(html).toContain("Samuel Willian");
    // Valores separados pelas letras do CIVIL
    expect(html).toContain("Cliente no centro");
    expect(html).toContain("Inteligência em resultados");
    // Totais só da Dinâmica 1: 3 aproximaram, 2 afastaram
    expect(html).toMatch(/>3<\/span> aproximaram/);
    expect(html).toMatch(/>2<\/span> afastaram/);
  });
});
