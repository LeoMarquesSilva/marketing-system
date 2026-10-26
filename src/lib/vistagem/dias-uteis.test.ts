import { describe, expect, it } from "vitest";
import {
  criarCalendario,
  criarCalendarioDePrazo,
  datasDoPrazo,
  fatalPorContagem,
  fatalPorDias,
  fatalPorDiasCorridos,
  feriadosNacionais,
  noRecessoForense,
  pascoa,
  somarDiasUteis,
} from "./dias-uteis";

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

  it("segue o fluxo da tarefa: Protocolar em 4 dias (D-5) ou sem Protocolar", () => {
    expect(datasDoPrazo("2026-11-23", util, { revisar: 1, protocolar: 4 })).toEqual({
      fatal: "2026-11-23",
      enviar: "2026-11-13",
      revisar: "2026-11-16",
      protocolar: "2026-11-19",
    });
    expect(datasDoPrazo("2026-11-23", util, null)).toEqual({ fatal: "2026-11-23", enviar: "2026-11-19", revisar: null, protocolar: null });
  });

  it("anda zero dias sem mexer na data", () => {
    expect(somarDiasUteis("2026-10-17", 0, util)).toBe("2026-10-17");
  });
});

describe("contagem do prazo", () => {
  // Base do SIOE de 2026 sem Dia da Bandeira e Dia do Servidor + feriados nacionais calculados de 2027.
  const FERIADOS = [
    ...["01-01", "02-16", "02-17", "04-03", "04-21", "05-01", "06-04", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `2026-${md}`),
    ...feriadosNacionais(2027),
  ];
  const contaPrazo = criarCalendarioDePrazo(FERIADOS);

  it("calcula a Páscoa e os feriados móveis", () => {
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2027)).toBe("2027-03-28");
    expect(feriadosNacionais(2027)).toEqual(
      expect.arrayContaining(["2027-02-08", "2027-02-09", "2027-03-26", "2027-05-27", "2027-11-20"])
    );
  });

  it("suspende o prazo no recesso forense (20/12 a 20/01)", () => {
    expect(noRecessoForense("2026-12-19")).toBe(false);
    expect(noRecessoForense("2026-12-20")).toBe(true);
    expect(noRecessoForense("2027-01-20")).toBe(true);
    expect(noRecessoForense("2027-01-21")).toBe(false);
  });

  it("conta os atalhos a partir da publicação de 14/10/2026", () => {
    const atalhos = [5, 10, 15, 30, 60, 90, 180].map((dias) => fatalPorDias("2026-10-14", dias, contaPrazo));
    expect(atalhos).toEqual([
      "2026-10-21",
      "2026-10-28", // 28/10 (Dia do Servidor) conta como dia útil
      "2026-11-05", // pula Finados
      "2026-11-27", // pula Consciência Negra; 19/11 (Bandeira) conta
      "2027-02-12", // 45 dias até 18/12, recesso, volta em 21/01, pula Carnaval
      "2027-03-29",
      "2027-08-04",
    ]);
  });
});

describe("dias corridos", () => {
  const FERIADOS = [...["10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `2026-${md}`), ...feriadosNacionais(2027)];
  const contaPrazo = criarCalendarioDePrazo(FERIADOS);

  it("começa no 1º dia útil após a publicação e conta todos os dias", () => {
    // publicação segunda 19/10: dia 1 = 20/10; 02/11 (Finados) conta → 03/11
    expect(fatalPorDiasCorridos("2026-10-19", 15, contaPrazo)).toBe("2026-11-03");
    // publicação sexta 16/10: dia 1 = segunda 19/10 → 23/10
    expect(fatalPorDiasCorridos("2026-10-16", 5, contaPrazo)).toBe("2026-10-23");
  });

  it("vencimento em fim de semana ou feriado passa para o próximo dia útil", () => {
    // 20/10 + 4 = sábado 24/10 → segunda 26/10
    expect(fatalPorDiasCorridos("2026-10-19", 5, contaPrazo)).toBe("2026-10-26");
    // dia 1 = sexta 30/10; dia 4 = segunda 02/11 (Finados) → 03/11
    expect(fatalPorDiasCorridos("2026-10-29", 4, contaPrazo)).toBe("2026-11-03");
  });

  it("o recesso forense suspende a contagem", () => {
    // 15 a 19/12 = 5 dias; 20/12 a 20/01 não contam; 21/01 é o 6º → 10º = segunda 25/01/2027
    expect(fatalPorDiasCorridos("2026-12-14", 10, contaPrazo)).toBe("2027-01-25");
    // publicada no recesso: começa em 21/01/2027
    expect(fatalPorDiasCorridos("2026-12-22", 5, contaPrazo)).toBe("2027-01-25");
  });

  it("fatalPorContagem escolhe a contagem", () => {
    expect(fatalPorContagem("2026-10-19", 15, "corridos", contaPrazo)).toBe("2026-11-03");
    expect(fatalPorContagem("2026-10-19", 15, "uteis", contaPrazo)).toBe(fatalPorDias("2026-10-19", 15, contaPrazo));
  });
});
