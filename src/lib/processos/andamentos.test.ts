import { describe, expect, it } from "vitest";
import { porMes, rotuloDoGrau, type Andamento } from "./andamentos";
import { andamentosDoDataJud, dataHoraDoDataJud } from "./capa";

describe("linha do tempo", () => {
  it("lê a data e hora do DataJud nos dois formatos", () => {
    expect(dataHoraDoDataJud("2025-07-14T10:20:30.000Z")).toBe("2025-07-14T10:20:30.000Z");
    expect(dataHoraDoDataJud("20250714102030")).toBe("2025-07-14T10:20:30.000Z");
    expect(dataHoraDoDataJud("")).toBeNull();
    expect(dataHoraDoDataJud("sem data")).toBeNull();
  });

  it("transforma os movimentos de todas as instâncias em andamentos, sem repetir", () => {
    const movimento = { codigo: 11, nome: "Distribuído por sorteio", dataHora: "2025-01-10T09:00:00.000Z", complementosTabelados: [{ nome: "competência exclusiva" }] };
    const andamentos = andamentosDoDataJud([
      { grau: "G1", movimentos: [movimento, movimento, { codigo: 22, nome: "Conclusos para despacho", dataHora: "2025-02-01T12:00:00.000Z" }, { nome: "", dataHora: "2025-03-01" }] },
      { grau: "G2", movimentos: [{ codigo: 33, nome: "Recebido o recurso", dataHora: "20250401080000" }] },
    ]);
    expect(andamentos.map((item) => item.titulo)).toEqual(["Recebido o recurso", "Conclusos para despacho", "Distribuído por sorteio"]);
    expect(andamentos[2]).toMatchObject({ grau: "G1", codigo: 11, detalhe: "competência exclusiva", fonte: "datajud" });
    expect(new Set(andamentos.map((item) => item.chave)).size).toBe(3);
  });

  it("nomeia a instância e agrupa por mês, do mais novo ao mais antigo", () => {
    expect(rotuloDoGrau("G1")).toBe("1º grau");
    expect(rotuloDoGrau("g2")).toBe("2º grau");
    expect(rotuloDoGrau(null)).toBeNull();
    const item = (id: string, quando: string): Andamento => ({ id, quando, fonte: "datajud", titulo: id, detalhe: null, grau: null });
    const grupos = porMes([item("a", "2025-01-10T12:00:00Z"), item("b", "2025-03-05T12:00:00Z"), item("c", "2025-03-20T12:00:00Z")]);
    expect(grupos.map((grupo) => grupo.itens.map((andamento) => andamento.id))).toEqual([["c", "b"], ["a"]]);
    expect(grupos[0].mes).toMatch(/março de 2025/);
  });
});
