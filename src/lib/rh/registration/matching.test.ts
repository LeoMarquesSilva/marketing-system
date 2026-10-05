import { describe, expect, it } from "vitest";
import { scoreNameMatch, suggestRegistrationMatches, type MatchCandidate } from "./matching";

function candidate(id: string, fullName: string, cpf: string | null = null): MatchCandidate {
  return { id, full_name: fullName, cpf, department: null, position: null };
}

describe("scoreNameMatch", () => {
  it("ignora acentos, caixa e partículas", () => {
    expect(scoreNameMatch("JOÃO DA SILVA", "Joao Silva")).toBe(1);
  });

  it("reconhece nome abreviado contido no completo", () => {
    expect(scoreNameMatch("Ana Souza", "Ana Paula Lima Souza")).toBe(0.9);
  });

  it("aceita primeiro e último nome iguais", () => {
    expect(scoreNameMatch("Maria Clara Fernandes", "Maria Eduarda Fernandes")).toBe(0.85);
  });

  it("não sugere quando o primeiro nome muda", () => {
    expect(scoreNameMatch("Ana Souza", "Beatriz Souza")).toBe(0);
  });

  it("não sugere só pelo primeiro nome", () => {
    expect(scoreNameMatch("Ana Souza", "Ana Ribeiro")).toBe(0);
  });
});

describe("suggestRegistrationMatches", () => {
  it("prioriza CPF igual sobre nome", () => {
    const result = suggestRegistrationMatches(
      { names: ["Ana Souza"], cpf: "529.982.247-25" },
      [candidate("1", "Ana Souza"), candidate("2", "Fulana Qualquer", "52998224725")]
    );
    expect(result.map((item) => [item.employeeId, item.reason])).toEqual([
      ["2", "cpf"],
      ["1", "nome"],
    ]);
  });

  it("descarta homônimo com outro CPF já cadastrado", () => {
    const result = suggestRegistrationMatches(
      { names: ["Ana Souza"], cpf: "529.982.247-25" },
      [candidate("1", "Ana Souza", "111.444.777-35")]
    );
    expect(result).toEqual([]);
  });

  it("usa tanto o nome do convite quanto o declarado", () => {
    const result = suggestRegistrationMatches(
      { names: ["Bia", "Beatriz Mendes Rocha"], cpf: null },
      [candidate("1", "Beatriz Rocha")]
    );
    expect(result[0]?.employeeId).toBe("1");
  });
});
