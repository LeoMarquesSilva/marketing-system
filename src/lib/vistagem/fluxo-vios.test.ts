import { describe, expect, it } from "vitest";
import { cadeiaDoFluxo, diasDoPrazo, montarFluxo, papelNoFluxo, type TipoNaArvore } from "./fluxo-vios";

// Recorte da árvore do VIOS (processos-etapas-tree.php) em 15/10/2026.
const ARVORE = new Map<number, TipoNaArvore>([
  [452, { nome: "COMPROVAR PAGAMENTO", prazo: "2 dias", criacao: [321, 314, 414, 313], conclusao: [] }],
  [612, { nome: "MANIFESTAÇÃO - FLUXO D5", prazo: null, criacao: [321, 314, 482], conclusao: [] }],
  [155, { nome: "AGRAVO DE PETIÇÃO", prazo: "5 dias", criacao: [462, 321, 314, 414, 313], conclusao: [] }],
  [731, { nome: "ACOMPANHAMENTO PROCESSUAL DIÁRIO", prazo: "1 dia", criacao: [], conclusao: [731] }],
  [47, { nome: "CUSTAS INICIAIS", prazo: "5 dias", criacao: [], conclusao: [] }],
  [321, { nome: "1. CIÊNCIA DOS AGENDAMENTOS", prazo: null, criacao: [], conclusao: [] }],
  [314, { nome: "2. REVISAR", prazo: "1 dia", criacao: [], conclusao: [] }],
  [313, { nome: "3. PROTOCOLAR", prazo: "2 dias", criacao: [], conclusao: [318] }],
  [482, { nome: "3. PROTOCOLAR", prazo: "4 dias", criacao: [], conclusao: [483] }],
  [414, { nome: "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", prazo: "1 dia", criacao: [], conclusao: [] }],
  [462, { nome: "EMBARGOS DE DECLARAÇÃO", prazo: null, criacao: [314, 313], conclusao: [] }],
  [318, { nome: "4. VALIDAR PROTOCOLO", prazo: null, criacao: [], conclusao: [] }],
  [483, { nome: "4. VALIDAR PROTOCOLO", prazo: null, criacao: [], conclusao: [] }],
]);

describe("fluxo automático do VIOS", () => {
  it("decide quem fica em cada tarefa como o robô", () => {
    expect(papelNoFluxo("2. REVISAR")).toBe("revisor");
    expect(papelNoFluxo("3. PROTOCOLAR")).toBe("protocolar");
    expect(papelNoFluxo("3.1 PROTOCOLAR")).toBe("protocolar");
    expect(papelNoFluxo("1. CIÊNCIA DOS AGENDAMENTOS")).toBe("responsavel");
    expect(papelNoFluxo("REVISAR DOCUMENTO DIÁRIO")).toBe("responsavel");
  });

  it("lê o prazo da árvore", () => {
    expect(diasDoPrazo("2 dias")).toBe(2);
    expect(diasDoPrazo("1 dia")).toBe(1);
    expect(diasDoPrazo(null)).toBeNull();
  });

  it("monta o que a tarefa cria junto, encadeado e na conclusão", () => {
    const fluxo = montarFluxo("452", ARVORE);
    expect(fluxo?.criacao.map((tarefa) => [tarefa.nome, tarefa.papel])).toEqual([
      ["1. CIÊNCIA DOS AGENDAMENTOS", "responsavel"],
      ["2. REVISAR", "revisor"],
      ["INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", "responsavel"],
      ["3. PROTOCOLAR", "protocolar"],
    ]);
    expect(fluxo?.criacao[3].aoConcluir).toEqual(["4. VALIDAR PROTOCOLO"]);
    expect(montarFluxo("155", ARVORE)?.criacao[0].tambemCria).toEqual(["2. REVISAR", "3. PROTOCOLAR"]);
    expect(montarFluxo("731", ARVORE)?.conclusao.map((tarefa) => tarefa.nome)).toEqual(["ACOMPANHAMENTO PROCESSUAL DIÁRIO"]);
    expect(montarFluxo("47", ARVORE)).toBeNull();
    expect(montarFluxo("999", ARVORE)).toBeNull();
  });

  it("tira a cadeia do Prazo do 3. PROTOCOLAR do fluxo", () => {
    expect(cadeiaDoFluxo(montarFluxo("452", ARVORE))).toEqual({ revisar: 1, protocolar: 2 });
    expect(cadeiaDoFluxo(montarFluxo("612", ARVORE))).toEqual({ revisar: 1, protocolar: 4 });
    expect(cadeiaDoFluxo(montarFluxo("47", ARVORE))).toBeNull();
  });
});
