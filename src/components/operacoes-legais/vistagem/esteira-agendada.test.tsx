import { describe, expect, it } from "vitest";
import type { ConferenciaItem } from "@/lib/vistagem/types";
import { etapasDaEsteira, situacaoAgendada } from "./esteira-agendada";

function item(publicacao: Partial<ConferenciaItem["publicacao"]>): ConferenciaItem {
  return {
    publicacao: {
      status: "abertura_pasta",
      vistadoEm: "2026-11-09T14:00:00Z",
      centralItemId: null,
      centralEnviadaEm: null,
      centralErro: null,
      ...publicacao,
    } as ConferenciaItem["publicacao"],
    areaProcesso: null,
    agendamentos: [],
    inconsistencias: [],
    vistadoPor: "Ana Souza",
    devolvidoPor: null,
    revistadoPor: null,
    conferidoPor: null,
  };
}

describe("esteira da abertura de pasta", () => {
  it("a publicação sem pasta fica na situação Abertura de pasta", () => {
    expect(situacaoAgendada(item({}))).toBe("central");
  });

  it("tem só a vistagem e a Central, sem conferência nem robô", () => {
    const etapas = etapasDaEsteira(item({ centralItemId: "64200", centralEnviadaEm: "2026-11-09T14:00:05Z" }));
    expect(etapas.map((etapa) => etapa.chave)).toEqual(["vistada", "central"]);
    expect(etapas[1]).toMatchObject({ estado: "feita", quando: "2026-11-09T14:00:05Z" });
    expect(etapas[1].texto).toContain("item 64200");
  });

  it("marca o problema quando o pedido não chegou à Central", () => {
    expect(etapasDaEsteira(item({ centralErro: "A Central recusou" }))[1]).toMatchObject({ estado: "problema" });
  });

  it("enquanto cria o pedido, a etapa está em andamento", () => {
    expect(etapasDaEsteira(item({}))[1]).toMatchObject({ estado: "atual" });
  });

  it("um erro antigo não apaga o item que depois foi criado", () => {
    expect(etapasDaEsteira(item({ centralItemId: "64200", centralErro: "falhou antes" }))[1]).toMatchObject({ estado: "feita" });
  });
});
