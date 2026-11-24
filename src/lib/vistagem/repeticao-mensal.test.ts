import { describe, expect, it } from "vitest";
import { criarCalendario, feriadosNacionais } from "./dias-uteis";
import { fatalNoMes, fataisDaRepeticao, textoDaRepeticao, vezesDaRepeticao } from "./repeticao-mensal";

// Calendário real: fim de semana e feriados nacionais (25/12/2026, 01/01/2027…). O recesso forense não entra.
const ehDiaUtil = criarCalendario([...feriadosNacionais(2026), ...feriadosNacionais(2027)]);

describe("COMPROVAR PAGAMENTO todo mês (pedido de 24/11/2026)", () => {
  it("fatal 30/11 em 4x: 30/11, 30/12, 29/01 (30/01 é sábado) e 26/02 (fevereiro não tem 30; 28/02 é domingo)", () => {
    expect(fataisDaRepeticao("2026-11-30", 4, ehDiaUtil)).toEqual(["2026-11-30", "2026-12-30", "2027-01-29", "2027-02-26"]);
  });

  it("segue o que a Trabalhista fazia à mão: o mesmo dia do mês ou o dia útil anterior", () => {
    // 0011072-34 (parcelas do dia 13): 13/02 e 13/03/2027 são sábados.
    expect(fataisDaRepeticao("2027-01-13", 4, ehDiaUtil)).toEqual(["2027-01-13", "2027-02-12", "2027-03-12", "2027-04-13"]);
    // 0011096-59 (parcelas do dia 20): 20/02 e 20/03/2027 são sábados.
    expect(fataisDaRepeticao("2027-01-20", 4, ehDiaUtil)).toEqual(["2027-01-20", "2027-02-19", "2027-03-19", "2027-04-20"]);
  });

  it("conta sempre do dia da primeira fatal, não da anterior: 31/01 → 26/02 → 31/03", () => {
    expect(fataisDaRepeticao("2027-01-29", 1, ehDiaUtil)).toEqual(["2027-01-29"]);
    expect(fatalNoMes("2027-01-31", 1, ehDiaUtil)).toBe("2027-02-26");
    expect(fatalNoMes("2027-01-31", 2, ehDiaUtil)).toBe("2027-03-31");
  });

  it("feriado vai para o dia útil anterior; o recesso forense não muda a data", () => {
    expect(fatalNoMes("2026-11-25", 1, ehDiaUtil)).toBe("2026-12-24");
    // 18/01/2027 cai no recesso (20/12 a 20/01), mas a parcela vence nele do mesmo jeito.
    expect(fatalNoMes("2026-11-18", 2, ehDiaUtil)).toBe("2027-01-18");
  });

  it("passa de um ano para o outro", () => {
    expect(fataisDaRepeticao("2026-12-15", 3, ehDiaUtil)).toEqual(["2026-12-15", "2027-01-15", "2027-02-15"]);
  });

  it("a primeira fica como foi escolhida, mesmo fora de dia útil", () => {
    expect(fataisDaRepeticao("2026-11-29", 2, ehDiaUtil)).toEqual(["2026-11-29", "2026-12-29"]);
  });

  it("sem fatal válida, nenhuma data", () => {
    expect(fataisDaRepeticao("", 4, ehDiaUtil)).toEqual([]);
    expect(fataisDaRepeticao("30/11/2026", 4, ehDiaUtil)).toEqual([]);
  });

  it("vezes: um número inteiro de 1 em diante; o resto vale 1", () => {
    expect(vezesDaRepeticao(4)).toBe(4);
    expect(vezesDaRepeticao("4")).toBe(4);
    for (const valor of [0, -2, 2.5, null, undefined, "", "x", Number.NaN]) expect(vezesDaRepeticao(valor)).toBe(1);
  });

  it("texto da observação", () => {
    expect(textoDaRepeticao(2, 4)).toBe("Repetição mensal: 2 de 4.");
  });
});
