import { describe, expect, it } from "vitest";
import { origemDaFatal, type TarefaComFatal } from "./origem-da-fatal";

const prazo = (extra: Partial<TarefaComFatal> = {}): TarefaComFatal => ({ etiqueta: "PRAZO", dataFatal: "2026-12-08", ...extra });
const mudouFatal = [{ por: "Giovanna", em: "2026-11-17T16:29:55Z", mudancas: [{ campo: "Data fatal", de: "08/12/2026", para: "10/12/2026" }] }];

describe("origemDaFatal: botão ou calendário, explícito (pedido de 18/11/2026)", () => {
  it("botão de dias: diz qual botão e a contagem", () => {
    expect(origemDaFatal(prazo({ origemPrazo: "atalho", diasPrazo: 15, contagemPrazo: "uteis" }))).toMatchObject({
      origem: "atalho",
      rotulo: "Botão 15 dias úteis",
      mudadaNaConferencia: false,
    });
    expect(origemDaFatal(prazo({ origemPrazo: "atalho", diasPrazo: 30, contagemPrazo: "corridos" }))?.rotulo).toBe("Botão 30 dias corridos");
  });

  it("calendário: diz que foi no calendário, sem os botões", () => {
    const origem = origemDaFatal(prazo({ origemPrazo: "calendario" }));
    expect(origem?.rotulo).toBe("Calendário");
    expect(origem?.descricao).toContain("escolhida no calendário, sem os botões de dias (5/10/15…)");
  });

  it("fatal mudada na conferência: continua o que o vistador usou e marca a mudança", () => {
    const origem = origemDaFatal(prazo({ origemPrazo: "calendario", ajustes: mudouFatal }));
    expect(origem).toMatchObject({ origem: "calendario", rotulo: "Calendário", mudadaNaConferencia: true });
    expect(origem?.descricao).toContain("Depois, a Conferência mudou a data fatal.");
  });

  it("ajuste só de responsável não conta como fatal mudada", () => {
    const ajustes = [{ por: "Giovanna", em: "2026-11-17T18:45:40Z", mudancas: [{ campo: "Responsável", de: "Ana", para: "Bia" }] }];
    expect(origemDaFatal(prazo({ origemPrazo: "atalho", diasPrazo: 5, contagemPrazo: "uteis", ajustes }))?.mudadaNaConferencia).toBe(false);
  });

  it("sem origem gravada: diz que não ficou registrado", () => {
    expect(origemDaFatal(prazo({ origemPrazo: null }))).toMatchObject({ origem: null, rotulo: "não registrado se foi botão ou calendário" });
  });

  it("fora do Prazo com fatal: nada", () => {
    expect(origemDaFatal({ etiqueta: "PROVIDENCIA", dataFatal: null, origemPrazo: "calendario" })).toBeNull();
    expect(origemDaFatal(prazo({ dataFatal: null, origemPrazo: "atalho" }))).toBeNull();
  });
});

describe("botão usado mesmo com a fatal mudada na Conferência (pedido de 19/11/2026)", () => {
  // A Conferência apaga os dias da tarefa ao mudar a fatal; o ajuste guarda quais eram.
  const comDias = [
    {
      por: "Giovanna",
      em: "2026-11-18T14:00:00Z",
      mudancas: [
        { campo: "Data fatal", de: "09/12/2026", para: "11/12/2026" },
        { campo: "Dias do prazo", de: "15 dias úteis", para: "fatal mudada na Conferência" },
      ],
    },
  ];

  it("o selo diz qual botão o vistador usou", () => {
    const origem = origemDaFatal(prazo({ origemPrazo: "atalho", diasPrazo: null, contagemPrazo: null, ajustes: comDias }));
    expect(origem).toMatchObject({ rotulo: "Botão 15 dias úteis", mudadaNaConferencia: true });
    expect(origem?.descricao).toContain("botão de 15 dias úteis");
    expect(origem?.descricao).toContain("Depois, a Conferência mudou a data fatal.");
  });

  it("vale também para a sugestão da IA e o prazo da tarefa; sem os dias guardados, fica \"Botões de dias\"", () => {
    expect(origemDaFatal(prazo({ origemPrazo: "sugestao_ia", ajustes: comDias }))?.rotulo).toBe("Sugestão da IA (15 dias úteis)");
    expect(origemDaFatal(prazo({ origemPrazo: "tarefa", ajustes: comDias }))?.rotulo).toBe("Prazo legal da tarefa (15 dias úteis)");
    expect(origemDaFatal(prazo({ origemPrazo: "atalho", ajustes: mudouFatal }))?.rotulo).toBe("Botões de dias");
  });
});

describe("origemDaFatal: repetição mensal do COMPROVAR PAGAMENTO (pedido de 24/11/2026)", () => {
  it("diz que a fatal veio da repetição mensal, e não do calendário", () => {
    const origem = origemDaFatal(prazo({ origemPrazo: "repeticao" }));
    expect(origem).toMatchObject({ origem: "repeticao", rotulo: "Repetição mensal", mudadaNaConferencia: false });
    expect(origem?.descricao).toContain("mesmo dia do mês da primeira fatal");
  });
});
