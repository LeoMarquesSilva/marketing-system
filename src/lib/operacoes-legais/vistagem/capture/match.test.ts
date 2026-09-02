import { describe, expect, it } from "vitest";
import { applyTributarioRules, matchKurrierRow, pickProcessForCnj } from "./match";
import type { ProcessBaseRow } from "@/lib/operacoes-legais/vistagem/types";

describe("match", () => {
  it("prefer Ativo no dedup", () => {
    const rows: ProcessBaseRow[] = [
      {
        ci: "1",
        cnj: "x",
        situacao: "Encerrado",
        area: null,
        cliente: null,
        escritorio_responsavel: "CÍVEL",
        acao: null,
        fase: null,
        advogado_responsavel: null,
        processo_encerrado: "Sim",
        titulo: null,
        grupo: null,
        vinculo: "PROCESSO PRINCIPAL",
        demanda_risco: null,
      },
      {
        ci: "2",
        cnj: "x",
        situacao: "Ativo",
        area: null,
        cliente: null,
        escritorio_responsavel: "TRABALHISTA",
        acao: null,
        fase: null,
        advogado_responsavel: null,
        processo_encerrado: "Não",
        titulo: null,
        grupo: "Grupo A",
        vinculo: "PROCESSO PRINCIPAL",
        demanda_risco: null,
      },
    ];
    expect(pickProcessForCnj(rows)?.ci).toBe("2");
  });

  it("match gera POSSÍVEL ABERTURA sem processo", () => {
    const m = matchKurrierRow(
      { numero_processo: "1000000-00.2026.8.26.0001", publicacao: "texto" },
      new Map(),
    );
    expect(m.status).toBe("MATCH_PENDENTE");
    expect(m.escritorio_responsavel).toBe("POSSÍVEL ABERTURA DE PASTA");
  });

  it("tributario verdeco permanece", () => {
    const r = applyTributarioRules({
      escritorio_responsavel: "TRIBUTÁRIO",
      grupo: "Grupo Verdeco",
    });
    expect(r.escritorio_responsavel).toBe("TRIBUTÁRIO");
  });

  it("tributario outro grupo vira insolvencia", () => {
    const r = applyTributarioRules({
      escritorio_responsavel: "TRIBUTÁRIO",
      grupo: "Grupo XYZ",
    });
    expect(r.escritorio_responsavel).toBe("INSOLVÊNCIA");
  });
});
