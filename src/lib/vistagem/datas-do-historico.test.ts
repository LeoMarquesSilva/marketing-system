import { describe, expect, it } from "vitest";
import { agruparPorDia, diaDoMomento, horaDoMomento, tituloDoDia } from "./datas-do-historico";

describe("datas dos históricos", () => {
  it("dia e hora em São Paulo, mesmo de madrugada em UTC", () => {
    expect(diaDoMomento("2026-11-14T01:30:00Z")).toBe("2026-11-13");
    expect(horaDoMomento("2026-11-13T17:49:00Z")).toBe("14:49");
  });

  it("título do dia com Hoje e Ontem", () => {
    const agora = Date.parse("2026-11-13T20:00:00Z");
    expect(tituloDoDia("2026-11-13", agora)).toBe("Hoje · sexta-feira, 13/11");
    expect(tituloDoDia("2026-11-12", agora)).toBe("Ontem · quinta-feira, 12/11");
    expect(tituloDoDia("2026-11-09", agora)).toBe("segunda-feira, 09/11");
  });

  it("agrupa pelo dia, na ordem", () => {
    const itens = [{ em: "2026-11-12T15:00:00Z" }, { em: "2026-11-13T12:00:00Z" }, { em: "2026-11-13T18:00:00Z" }];
    expect(agruparPorDia(itens, (item) => item.em).map(([dia, doDia]) => [dia, doDia.length])).toEqual([
      ["2026-11-12", 1],
      ["2026-11-13", 2],
    ]);
  });
});
