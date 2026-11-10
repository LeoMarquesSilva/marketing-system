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

  it("conferida, tem a vistagem, a conferência e a Central, sem o robô", () => {
    const etapas = etapasDaEsteira({
      ...item({ centralItemId: "64200", centralEnviadaEm: "2026-11-09T14:00:05Z", conferidoEm: "2026-11-09T13:59:00Z" }),
      conferidoPor: "Maria Heloiza",
    });
    expect(etapas.map((etapa) => etapa.chave)).toEqual(["vistada", "conferencia", "central"]);
    expect(etapas[1]).toMatchObject({ estado: "feita", quem: "Maria Heloiza", quando: "2026-11-09T13:59:00Z" });
    expect(etapas[2]).toMatchObject({ estado: "feita", quando: "2026-11-09T14:00:05Z" });
    expect(etapas[2].texto).toContain("item 64200");
  });

  it("sem pasta e ainda na conferência: a próxima etapa é a Central, não o robô", () => {
    const etapas = etapasDaEsteira(item({ status: "controladoria_vistar", pastaCi: null, pendencia: "sem_pasta" }));
    expect(etapas.map((etapa) => etapa.chave)).toEqual(["vistada", "conferencia", "central"]);
    expect(etapas.map((etapa) => etapa.estado)).toEqual(["feita", "atual", "pendente"]);
  });

  it("com pasta, na conferência, segue a esteira do robô", () => {
    const etapas = etapasDaEsteira(item({ status: "controladoria_vistar", pastaCi: "54372", pendencia: null }));
    expect(etapas.map((etapa) => etapa.chave)).toEqual(["vistada", "conferencia", "robo", "vios", "checada"]);
  });

  it("a que foi direto para a Central, sem conferência, mostra só a vistagem e a Central", () => {
    const etapas = etapasDaEsteira(item({ centralItemId: "64137", centralEnviadaEm: "2026-11-09T16:59:26Z" }));
    expect(etapas.map((etapa) => etapa.chave)).toEqual(["vistada", "central"]);
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
