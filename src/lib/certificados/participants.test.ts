import { describe, expect, it } from "vitest";
import { participantsFromRows, participantsFromText } from "./participants";

const simple = (list: ReturnType<typeof participantsFromRows>) => list.map(({ nome, email }) => ({ nome, email }));

describe("participantes da planilha", () => {
  it("acha as colunas Nome e E-mail mesmo com título acima", () => {
    const rows = [
      ["Lista de presença - Workshop"],
      ["Data", "Nome completo", "E-mail"],
      ["17/09", "Ana Nunes Galvão", "Ana@Exemplo.com.br"],
      ["17/09", "Vinicius Canto Hecksher", ""],
      ["", "", ""],
    ];
    expect(simple(participantsFromRows(rows))).toEqual([
      { nome: "Ana Nunes Galvão", email: "ana@exemplo.com.br" },
      { nome: "Vinicius Canto Hecksher", email: null },
    ]);
  });

  it("sem cabeçalho, usa a primeira coluna e acha o e-mail na linha", () => {
    const rows = [
      ["Ana Nunes Galvão", "ana@exemplo.com.br"],
      ["Midian Barbosa"],
    ];
    expect(simple(participantsFromRows(rows))).toEqual([
      { nome: "Ana Nunes Galvão", email: "ana@exemplo.com.br" },
      { nome: "Midian Barbosa", email: null },
    ]);
  });

  it("remove repetidos ignorando acento e caixa", () => {
    const rows = [["Nome"], ["Ana Galvão"], ["ana galvao"], ["  Ana   Galvão "]];
    expect(participantsFromRows(rows)).toHaveLength(1);
  });

  it("lê nomes colados, com ou sem e-mail", () => {
    const text = "Ana Nunes Galvão; ana@exemplo.com.br\nMidian Barbosa\n\nJoão\tjoao@exemplo.com.br";
    expect(simple(participantsFromText(text))).toEqual([
      { nome: "Ana Nunes Galvão", email: "ana@exemplo.com.br" },
      { nome: "Midian Barbosa", email: null },
      { nome: "João", email: "joao@exemplo.com.br" },
    ]);
  });
});
