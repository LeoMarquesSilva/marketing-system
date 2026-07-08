import { describe, expect, it } from "vitest";
import {
  clienteAtividadeTooltip,
  grupoClienteKey,
  isSioeCategoriaInativa,
  isSioeCategoriaAtiva,
  listSioeOnlyInactiveGroups,
  planoContasNaCota,
  resolveClienteAtividade,
} from "@/lib/sioe-cliente-atividade";

describe("planoContasNaCota", () => {
  it("aceita honorários na cota do SIOE", () => {
    expect(planoContasNaCota("HONORÁRIOS MENSAIS")).toBe(true);
    expect(planoContasNaCota("REEMBOLSO DE DESPESAS")).toBe(false);
  });
});

describe("isSioeCategoriaAtiva", () => {
  it("detecta categoria ativa do SIOE", () => {
    expect(isSioeCategoriaAtiva("Cliente ativo")).toBe(true);
    expect(isSioeCategoriaAtiva("Cliente inativo")).toBe(false);
  });
});

describe("isSioeCategoriaInativa", () => {
  it("detecta categoria inativa do SIOE", () => {
    expect(isSioeCategoriaInativa("Cliente inativo")).toBe(true);
    expect(isSioeCategoriaInativa("Cliente ativo")).toBe(false);
  });
});

describe("resolveClienteAtividade", () => {
  const index = {
    mesReferencia: "2026-07",
    grupoNames: { [grupoClienteKey("Grupo 3TM")]: "Grupo 3TM" },
    byGrupoKey: { [grupoClienteKey("Grupo 3TM")]: "ativo" as const },
    byPessoaId: { "pessoa-1": "inativo" as const },
  };

  it("prioriza pessoa sobre grupo", () => {
    expect(
      resolveClienteAtividade(index, {
        grupoName: "Grupo 3TM",
        sioePessoaId: "pessoa-1",
      })
    ).toBe("inativo");
  });

  it("usa grupo quando não há pessoa", () => {
    expect(resolveClienteAtividade(index, { grupoName: "Grupo 3TM" })).toBe("ativo");
  });
});

describe("listSioeOnlyInactiveGroups", () => {
  it("lista grupos inativos ausentes na base local", () => {
    const colomboKey = grupoClienteKey("Grupo Colombo");
    const listed = listSioeOnlyInactiveGroups(
      {
        mesReferencia: "2026-07",
        grupoNames: { [colomboKey]: "Grupo Colombo" },
        byGrupoKey: { [colomboKey]: "inativo" },
        byPessoaId: {},
      },
      new Set([grupoClienteKey("Grupo Levva")])
    );
    expect(listed).toEqual([{ key: `sioe-inativo:${colomboKey}`, name: "Grupo Colombo" }]);
  });
});

describe("clienteAtividadeTooltip", () => {
  it("descreve status ativo", () => {
    expect(clienteAtividadeTooltip("ativo", "2026-07")).toContain("Cliente ativo");
  });
});
