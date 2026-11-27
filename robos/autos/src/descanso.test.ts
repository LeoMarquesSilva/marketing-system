import { describe, expect, it } from "vitest";
import { Descansos } from "./descanso.ts";

const CHAVES = ["jusbr:BR", "pje:TJRJ", "eproc:TJSP"];
const MIN = 60_000;

describe("Descansos", () => {
  it("o conector que esperou a pessoa em vão sai da fila do robô e os outros seguem", () => {
    const descansos = new Descansos();
    descansos.descansar("pje:TJRJ", 0, 30 * MIN);
    expect(descansos.ativos(CHAVES, 1 * MIN)).toEqual(["jusbr:BR", "eproc:TJSP"]);
    expect(descansos.minutosRestantes("pje:TJRJ", 1 * MIN)).toBe(29);
  });

  it("volta quando o descanso termina", () => {
    const descansos = new Descansos();
    descansos.descansar("pje:TJRJ", 0, 30 * MIN);
    expect(descansos.ativos(CHAVES, 30 * MIN)).toEqual(CHAVES);
    expect(descansos.minutosRestantes("pje:TJRJ", 30 * MIN)).toBe(0);
  });

  it("descanso zero (PAUSA_APOS_PESSOA_MINUTOS=0) não tira o conector", () => {
    const descansos = new Descansos();
    descansos.descansar("pje:TJRJ", 0, 0);
    expect(descansos.ativos(CHAVES, 0)).toEqual(CHAVES);
  });

  it("um descanso mais curto não encurta o que já estava valendo", () => {
    const descansos = new Descansos();
    descansos.descansar("pje:TJRJ", 0, 30 * MIN);
    descansos.descansar("pje:TJRJ", 5 * MIN, 1 * MIN);
    expect(descansos.ativos(CHAVES, 10 * MIN)).toEqual(["jusbr:BR", "eproc:TJSP"]);
  });

  it("com todos descansando, não pede nada à fila", () => {
    const descansos = new Descansos();
    for (const chave of CHAVES) descansos.descansar(chave, 0, 10 * MIN);
    expect(descansos.ativos(CHAVES, MIN)).toEqual([]);
  });
});
