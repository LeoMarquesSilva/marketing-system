import { describe, expect, it } from "vitest";
import { criarCalendario, feriadosNacionais } from "./dias-uteis";
import { comMaisUmMes, comPrimeiraFatal, fatalNoMes, fataisDaRepeticao, textoDaRepeticao } from "./repeticao-mensal";

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
    expect(fataisDaRepeticao("2026-11-30", 0, ehDiaUtil)).toEqual([]);
  });

  it("no formulário: liga com o mês seguinte e cada \"Adicionar mês\" põe o próximo, com a data sugerida", () => {
    const um = comMaisUmMes([], "2026-11-30", ehDiaUtil);
    expect(um).toEqual([{ meses: 1, fatal: "2026-12-30", editada: false }]);
    const tres = comMaisUmMes(comMaisUmMes(um, "2026-11-30", ehDiaUtil), "2026-11-30", ehDiaUtil);
    expect(tres.map((mes) => mes.fatal)).toEqual(["2026-12-30", "2027-01-29", "2027-02-26"]);
    // Tirado um mês do meio, o próximo continua depois do último que ficou.
    expect(comMaisUmMes([tres[0], tres[2]], "2026-11-30", ehDiaUtil).at(-1)).toEqual({ meses: 4, fatal: "2027-03-30", editada: false });
    // Sem a 1ª fatal, o mês entra sem data.
    expect(comMaisUmMes([], "", ehDiaUtil)).toEqual([{ meses: 1, fatal: "", editada: false }]);
  });

  it("no formulário: mudou a 1ª fatal, as datas sugeridas acompanham e as mudadas pela pessoa ficam", () => {
    const meses = [
      { meses: 1, fatal: "2026-12-30", editada: false },
      { meses: 2, fatal: "2027-01-25", editada: true },
    ];
    expect(comPrimeiraFatal(meses, "2026-11-20", ehDiaUtil)).toEqual([
      { meses: 1, fatal: "2026-12-18", editada: false },
      { meses: 2, fatal: "2027-01-25", editada: true },
    ]);
    expect(comPrimeiraFatal(meses, "", ehDiaUtil)[0].fatal).toBe("");
  });

  it("texto da observação", () => {
    expect(textoDaRepeticao(2, 4)).toBe("Repetição mensal: 2 de 4.");
  });
});
