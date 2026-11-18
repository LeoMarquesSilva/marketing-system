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
