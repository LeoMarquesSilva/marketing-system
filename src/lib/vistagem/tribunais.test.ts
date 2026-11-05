import { describe, expect, it } from "vitest";
import { descricaoDoTribunal, ramoDoTribunal } from "./tribunais";

describe("tribunais nos filtros", () => {
  it("descreve TRTs, superiores, TJs e TRFs", () => {
    expect(descricaoDoTribunal("TRT2")).toBe("2ª Região · São Paulo");
    expect(descricaoDoTribunal("TRT-15")).toBe("15ª Região · Campinas");
    expect(descricaoDoTribunal("trt 01")).toBe("1ª Região · Rio de Janeiro");
    expect(descricaoDoTribunal("TST")).toBe("Tribunal Superior do Trabalho");
    expect(descricaoDoTribunal("TJSP")).toBe("Tribunal de Justiça de São Paulo");
    expect(descricaoDoTribunal("TJMG")).toBe("Tribunal de Justiça · MG");
    expect(descricaoDoTribunal("TRF3")).toBe("Tribunal Regional Federal · 3ª Região");
    expect(descricaoDoTribunal("DJE")).toBeNull();
    expect(descricaoDoTribunal(null)).toBeNull();
  });

  it("separa o ramo para a cor do ícone", () => {
    expect(ramoDoTribunal("TRT2")).toBe("trabalho");
    expect(ramoDoTribunal("TST")).toBe("superior");
    expect(ramoDoTribunal("TJSP")).toBe("estadual");
    expect(ramoDoTribunal("TRF3")).toBe("federal");
    expect(ramoDoTribunal("DJE")).toBe("outro");
  });
});
