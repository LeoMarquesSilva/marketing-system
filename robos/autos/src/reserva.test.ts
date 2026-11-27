import { describe, expect, it } from "vitest";
import { FalhaDoConector, MigradoParaEproc, SegredoDeJustica } from "./conectores/tipos.ts";
import { planoDaReserva, repasseDoMigrado } from "./reserva.ts";

const ESAJ = { chave: "esaj:TJSP" };
const EPROC = { chave: "eproc:TJSP" };
const JUSBR = { chave: "jusbr:BR" };
const falhaDoJusbr = new FalhaDoConector("o Jus.br não trouxe documentos deste processo.");

describe("planoDaReserva", () => {
  it("segue pelo conector da reserva quando este robô o tem", () => {
    expect(planoDaReserva({ sistema: "jusbr", reserva: "esaj:TJSP" }, falhaDoJusbr, [JUSBR, ESAJ, EPROC])).toEqual({ tipo: "seguir", reserva: "esaj:TJSP", conector: ESAJ });
  });

  it("repassa ao robô do tribunal quando este robô é só do Jus.br", () => {
    expect(planoDaReserva({ sistema: "jusbr", reserva: "esaj:TJSP" }, falhaDoJusbr, [JUSBR])).toEqual({ tipo: "repassar", reserva: "esaj:TJSP" });
    expect(planoDaReserva({ sistema: "jusbr", reserva: "eproc:TJSP" }, falhaDoJusbr, [JUSBR, ESAJ])).toEqual({ tipo: "repassar", reserva: "eproc:TJSP" });
  });

  it("sem reserva, o erro segue como erro do pedido", () => {
    expect(planoDaReserva({ sistema: "jusbr", reserva: null }, falhaDoJusbr, [JUSBR])).toBeNull();
    expect(planoDaReserva({ sistema: "jusbr" }, falhaDoJusbr, [JUSBR])).toBeNull();
  });

  it("só o pedido ao Jus.br usa a reserva", () => {
    expect(planoDaReserva({ sistema: "esaj", reserva: "eproc:TJSP" }, falhaDoJusbr, [ESAJ, EPROC])).toBeNull();
  });

  it("falha que não é do conector (segredo de justiça, erro inesperado) não usa a reserva", () => {
    expect(planoDaReserva({ sistema: "jusbr", reserva: "esaj:TJSP" }, new SegredoDeJustica(), [JUSBR])).toBeNull();
    expect(planoDaReserva({ sistema: "jusbr", reserva: "esaj:TJSP" }, new Error("inesperado"), [JUSBR])).toBeNull();
  });
});

describe("repasseDoMigrado", () => {
  it("processo migrado para o eproc volta à fila no eproc do tribunal", () => {
    expect(repasseDoMigrado(new MigradoParaEproc("eproc:TJRJ", "migrou"))).toBe("eproc:TJRJ");
  });

  it("outro erro não é repasse", () => {
    expect(repasseDoMigrado(new FalhaDoConector("não abriu"))).toBeNull();
    expect(repasseDoMigrado(new Error("inesperado"))).toBeNull();
  });

  it("sem o repasse, o migrado ainda é uma falha do conector (vira erro com a mensagem)", () => {
    expect(new MigradoParaEproc("eproc:TJRJ", "migrou")).toBeInstanceOf(FalhaDoConector);
  });
});
