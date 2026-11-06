import { describe, expect, it } from "vitest";
import { contagemPadraoDaArea } from "./agendamento";
import { prazoLegalDaTarefa } from "./prazo-legal";

describe("prazoLegalDaTarefa", () => {
  it("usa o CPC fora do Trabalhista", () => {
    expect(prazoLegalDaTarefa("APELAÇÃO", "Cível")).toBe(15);
    expect(prazoLegalDaTarefa("Agravo de Instrumento", "Insolvência")).toBe(15);
    expect(prazoLegalDaTarefa("EMBARGOS DE DECLARAÇÃO", "Cível | Insolvência")).toBe(5);
    expect(prazoLegalDaTarefa("RECURSO INOMINADO", "Cível")).toBe(10);
  });

  it("usa 8 dias nos recursos trabalhistas, 5 nos embargos de declaração e 15 para o STF", () => {
    expect(prazoLegalDaTarefa("RECURSO ORDINÁRIO", "Trabalhista")).toBe(8);
    expect(prazoLegalDaTarefa("RECURSO DE REVISTA", "TRABALHISTA")).toBe(8);
    expect(prazoLegalDaTarefa("AGRAVO DE PETIÇÃO", "Trabalhista")).toBe(8);
    expect(prazoLegalDaTarefa("CONTRARRAZÕES", "Trabalhista")).toBe(8);
    expect(prazoLegalDaTarefa("EMBARGOS DE DECLARAÇÃO", "Trabalhista")).toBe(5);
    expect(prazoLegalDaTarefa("RECURSO ESPECIAL/EXTRAORDINÁRIO", "Trabalhista")).toBe(15);
  });

  it("devolve null quando a tarefa não é recurso", () => {
    expect(prazoLegalDaTarefa("CONTESTAÇÃO", "Cível")).toBeNull();
    expect(prazoLegalDaTarefa("MANIFESTAÇÃO SOBRE LAUDO PERICIAL", "Trabalhista")).toBeNull();
    expect(prazoLegalDaTarefa("", "Cível")).toBeNull();
  });
});

describe("contagemPadraoDaArea", () => {
  it("marca Corridos só na Insolvência", () => {
    expect(contagemPadraoDaArea("Insolvência")).toBe("corridos");
    expect(contagemPadraoDaArea("INSOLVENCIA")).toBe("corridos");
    expect(contagemPadraoDaArea("Cível | Insolvência")).toBe("uteis");
    expect(contagemPadraoDaArea("Trabalhista")).toBe("uteis");
    expect(contagemPadraoDaArea(null)).toBe("uteis");
  });
});
