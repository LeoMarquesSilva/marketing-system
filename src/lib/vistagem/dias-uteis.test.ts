import { describe, expect, it } from "vitest";
import { criarCalendario, datasDoPrazo, fatalPorDias, somarDiasUteis } from "./dias-uteis";

const util = criarCalendario(["2026-11-02", "2026-11-20"]);

describe("dias úteis", () => {
  it("conta a partir do 1º dia útil após a publicação, pulando fim de semana", () => {
    // publicação quarta 14/10: 15, 16, 19, 20, 21 → 21/10
    expect(fatalPorDias("2026-10-14", 5, util)).toBe("2026-10-21");
  });

  it("pula feriados", () => {
    // publicação sexta 30/10: 02/11 é feriado → 03, 04, 05, 06, 09
    expect(fatalPorDias("2026-10-30", 5, util)).toBe("2026-11-09");
  });

  it("volta dias úteis para montar Enviar, Revisar e Protocolar", () => {
    // fatal segunda 23/11 (sexta 20/11 é feriado)
    expect(datasDoPrazo("2026-11-23", util)).toEqual({
      fatal: "2026-11-23",
      protocolar: "2026-11-19",
      revisar: "2026-11-18",
      enviar: "2026-11-17",
    });
  });

  it("anda zero dias sem mexer na data", () => {
    expect(somarDiasUteis("2026-10-17", 0, util)).toBe("2026-10-17");
  });
});
