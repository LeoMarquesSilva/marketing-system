import { describe, expect, it } from "vitest";
import { criarCalendario } from "./dias-uteis";
import { fluxoPrevisto } from "./fluxo-previsto";
import { montarFluxo, type TipoNaArvore } from "./fluxo-vios";

// Recorte da árvore do VIOS: o fluxo da 470 (IDPJ) do teste de 03/11/2026 e um tipo sem fluxo.
const ARVORE = new Map<number, TipoNaArvore>([
  [470, { nome: "APRESENTAÇÃO/IMPUGNAÇÃO AO IDPJ", prazo: "12 dias", criacao: [321, 314, 414, 313], conclusao: [] }],
  [731, { nome: "ACOMPANHAMENTO PROCESSUAL DIÁRIO", prazo: "1 dia", criacao: [], conclusao: [731] }],
  [316, { nome: "CIÊNCIA NF", prazo: null, criacao: [], conclusao: [] }],
  [321, { nome: "1. CIÊNCIA DOS AGENDAMENTOS", prazo: null, criacao: [], conclusao: [] }],
  [314, { nome: "2. REVISAR", prazo: "1 dia", criacao: [], conclusao: [] }],
  [313, { nome: "3. PROTOCOLAR", prazo: "2 dias", criacao: [], conclusao: [318] }],
  [414, { nome: "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", prazo: "1 dia", criacao: [], conclusao: [] }],
  [318, { nome: "4. VALIDAR PROTOCOLO", prazo: null, criacao: [], conclusao: [] }],
]);

// 20/11/2026 é feriado (Consciência Negra).
const ehDiaUtil = criarCalendario(["2026-11-20"]);

describe("fluxo previsto na conferência", () => {
  it("lista o que o VIOS cria junto, com as datas do Revisar e do Protocolar e quem fica em cada uma", () => {
    const previsto = fluxoPrevisto(
      { data: "2026-11-23", responsavel: "Vanessa Lanza Sellani", revisor: "Fernanda Voltarelli Arnoni" },
      montarFluxo("470", ARVORE),
      ehDiaUtil
    );
    // Igual ao que o VIOS criou para a CI 934332 (Revisar 24/11, Protocolar 25/11).
    expect(previsto).toEqual([
      { nome: "1. CIÊNCIA DOS AGENDAMENTOS", data: null, responsaveis: "Vanessa Lanza Sellani", quando: "criacao" },
      { nome: "2. REVISAR", data: "2026-11-24", responsaveis: "Fernanda Voltarelli Arnoni", quando: "criacao" },
      { nome: "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", data: null, responsaveis: "Vanessa Lanza Sellani", quando: "criacao" },
      { nome: "3. PROTOCOLAR", data: "2026-11-25", responsaveis: "Vanessa Lanza Sellani + Samuel Willian Silva", quando: "criacao" },
    ]);
  });

  it("pula o feriado na conta dos dias úteis", () => {
    const previsto = fluxoPrevisto({ data: "2026-11-19", responsavel: "Ana", revisor: "Bia" }, montarFluxo("470", ARVORE), ehDiaUtil);
    expect(previsto.find((tarefa) => tarefa.nome === "2. REVISAR")?.data).toBe("2026-11-23");
    expect(previsto.find((tarefa) => tarefa.nome === "3. PROTOCOLAR")?.data).toBe("2026-11-24");
  });

  it("sem revisor, o Revisar fica com o padrão do VIOS; o que nasce ao concluir vai à parte", () => {
    const comRevisar = fluxoPrevisto({ data: "2026-11-23", responsavel: "Ana", revisor: null }, montarFluxo("470", ARVORE), ehDiaUtil);
    expect(comRevisar.find((tarefa) => tarefa.nome === "2. REVISAR")?.responsaveis).toBe("padrão do VIOS (sem revisor)");
    const diario = fluxoPrevisto({ data: "2026-11-23", responsavel: "Ana", revisor: null }, montarFluxo("731", ARVORE), ehDiaUtil);
    expect(diario).toEqual([{ nome: "ACOMPANHAMENTO PROCESSUAL DIÁRIO", data: null, responsaveis: "padrão do VIOS", quando: "conclusao" }]);
  });

  it("tarefa sem fluxo não cria nada", () => {
    expect(fluxoPrevisto({ data: "2026-11-04", responsavel: "Ana", revisor: null }, montarFluxo("316", ARVORE), ehDiaUtil)).toEqual([]);
    expect(fluxoPrevisto({ data: "2026-11-04", responsavel: "Ana", revisor: null }, null, ehDiaUtil)).toEqual([]);
  });
});
