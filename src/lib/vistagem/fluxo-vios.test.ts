import { describe, expect, it } from "vitest";
import { fluxoCriaCiencia } from "./ciencia-agendamentos";
import { criarCalendario, dataDaTarefaSemPrazo, datasDoPrazo } from "./dias-uteis";
import { arvoreDaArea, cadeiaDoFluxo, diasDoPrazo, montarFluxo, papelNoFluxo, semPrazoProprio, type TipoNaArvore } from "./fluxo-vios";

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

describe("tarefa de Prazo sem prazo próprio", () => {
  // SENTENÇA (13): não cria 3. PROTOCOLAR, e os Embargos e o Recurso Ordinário que ela cria têm o seu.
  const COM_SENTENCA = new Map<number, TipoNaArvore>([
    ...ARVORE,
    [13, { nome: "SENTENÇA", prazo: null, criacao: [321, 414, 462, 153], conclusao: [] }],
    [153, { nome: "RECURSO ORDINÁRIO", prazo: "5 dias", criacao: [314, 313], conclusao: [] }],
  ]);

  it("é a que só cria tarefas que têm o próprio Protocolar", () => {
    expect(semPrazoProprio(montarFluxo("13", COM_SENTENCA))).toBe(true);
  });

  it("não é a que cria o Protocolar, nem a que não cria nenhum", () => {
    expect(semPrazoProprio(montarFluxo("452", COM_SENTENCA))).toBe(false);
    expect(semPrazoProprio(montarFluxo("155", COM_SENTENCA))).toBe(false);
    expect(semPrazoProprio(montarFluxo("731", COM_SENTENCA))).toBe(false);
    expect(semPrazoProprio(montarFluxo("47", COM_SENTENCA))).toBe(false);
    expect(semPrazoProprio(null)).toBe(false);
  });

  it("vai no dia da publicação, nunca antes de hoje nem em dia sem expediente", () => {
    const ehDiaUtil = criarCalendario(["2026-11-20"]);
    expect(dataDaTarefaSemPrazo("2026-11-10", "2026-11-09", ehDiaUtil)).toBe("2026-11-10");
    expect(dataDaTarefaSemPrazo("2026-11-06", "2026-11-09", ehDiaUtil)).toBe("2026-11-09");
    expect(dataDaTarefaSemPrazo(null, "2026-11-09", ehDiaUtil)).toBe("2026-11-09");
    expect(dataDaTarefaSemPrazo("2026-11-20", "2026-11-19", ehDiaUtil)).toBe("2026-11-23");
  });
});

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

describe("fluxo pela área da pasta", () => {
  // Tipo 425 e filhas como na árvore do VIOS em 09/11/2026 ("disponível para as áreas").
  const ARVORE_425 = new Map<number, TipoNaArvore>([
    [425, { nome: "RECURSO ESPECIAL/EXTRAORDINÁRIO", prazo: "12 dias", criacao: [83, 321, 739, 314, 414, 313, 426], conclusao: [] }],
    [83, { nome: "PREPARO APELAÇÃO/RE/RESP/AI/REXT/RI", prazo: null, criacao: [], conclusao: [] }],
    [321, { nome: "1. CIÊNCIA DOS AGENDAMENTOS", prazo: null, criacao: [], conclusao: [] }],
    [739, { nome: "ATUALIZAÇÃO DA SÍNTESE DO PROCESSO", prazo: null, criacao: [], conclusao: [] }],
    [314, { nome: "2. REVISAR", prazo: "1 dia", criacao: [], conclusao: [] }],
    [414, { nome: "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", prazo: "1 dia", criacao: [], conclusao: [] }],
    [313, { nome: "3. PROTOCOLAR", prazo: "2 dias", criacao: [], conclusao: [318] }],
    [426, { nome: "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", prazo: "3 dias", criacao: [], conclusao: [] }],
    [318, { nome: "4. VALIDAR PROTOCOLO", prazo: null, criacao: [], conclusao: [] }],
  ]);
  const idsDoFluxo = (area: (string | number)[] | null) => montarFluxo("425", arvoreDaArea(ARVORE_425, area))?.criacao.map((tarefa) => tarefa.id);

  it("na pasta Cível vem um só INFORMAR CLIENTE, o de 1 dia", () => {
    const civel = ["425", "83", "321", "739", "314", "414", "313", "318"];
    expect(idsDoFluxo(civel)).toEqual(["83", "321", "739", "314", "414", "313"]);
    const informar = montarFluxo("425", arvoreDaArea(ARVORE_425, civel))?.criacao.filter((tarefa) => tarefa.nome.startsWith("INFORMAR CLIENTE"));
    expect(informar?.map((tarefa) => tarefa.prazo)).toEqual(["1 dia"]);
  });

  it("em cada área vem o que o VIOS deixa para ela", () => {
    expect(idsDoFluxo(["425", "83", "321", "314", "313", "426", "318"])).toEqual(["83", "321", "314", "313", "426"]); // Contratos
    expect(idsDoFluxo(["425", "83", "321", "739", "314", "414", "313", "426", "318"])).toEqual(["83", "321", "739", "314", "414", "313", "426"]); // Recuperação de Crédito tem os dois
    expect(idsDoFluxo(["425", "83", "314", "313", "426", "318"])).toEqual(["83", "314", "313", "426"]); // Insolvência não tem a Ciência 321
  });

  it("vale também para o que a tarefa cria ao concluir", () => {
    const semValidar = arvoreDaArea(ARVORE_425, ["425", "314", "313"]);
    expect(montarFluxo("425", semValidar)?.criacao.find((tarefa) => tarefa.id === "313")?.aoConcluir).toEqual([]);
    expect(montarFluxo("313", arvoreDaArea(ARVORE_425, ["313", "318"]))?.conclusao.map((tarefa) => tarefa.id)).toEqual(["318"]);
  });

  it("vale para quem a filha cria junto", () => {
    const encadeada = arvoreDaArea(ARVORE, ["155", "462", "321", "314", "414"]); // sem o 3. PROTOCOLAR 313
    const embargos = montarFluxo("155", encadeada)?.criacao.find((tarefa) => tarefa.id === "462");
    expect(embargos?.filhas.map((tarefa) => tarefa.id)).toEqual(["314"]);
    expect(embargos?.tambemCria).toEqual(["2. REVISAR"]);
  });

  it("sem o 3. PROTOCOLAR na área, a cadeia do Prazo fica sem ele", () => {
    expect(cadeiaDoFluxo(montarFluxo("612", ARVORE))).toEqual({ revisar: 1, protocolar: 4 });
    expect(cadeiaDoFluxo(montarFluxo("612", arvoreDaArea(ARVORE, ["612", "321", "314"])))).toBeNull();
  });

  it("sem a lista da área, fica a árvore inteira", () => {
    expect(arvoreDaArea(ARVORE_425, null)).toBe(ARVORE_425);
    expect(arvoreDaArea(ARVORE_425, [])).toBe(ARVORE_425);
  });

  it("a Ciência dos Agendamentos que a área não tem não conta como criada pelo fluxo", () => {
    expect(fluxoCriaCiencia(montarFluxo("425", ARVORE_425))).toBe(true);
    expect(fluxoCriaCiencia(montarFluxo("425", arvoreDaArea(ARVORE_425, ["425", "83", "314", "313", "426"])))).toBe(false);
  });
});

describe("classe das tarefas do fluxo", () => {
  it("leva a classe do tipo no VIOS para a tarefa criada junto (dá a cor no fluxo)", () => {
    const arvore = new Map<number, TipoNaArvore>([
      [36, { nome: "AGRAVO DE INSTRUMENTO", prazo: null, criacao: [426, 314], conclusao: [], classe: "PRAZO" }],
      [426, { nome: "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", prazo: "2 dias", criacao: [], conclusao: [], classe: "PROVIDENCIA" }],
      [314, { nome: "2. REVISAR", prazo: null, criacao: [], conclusao: [] }],
    ]);
    expect(montarFluxo("36", arvore)?.criacao.map((tarefa) => [tarefa.nome, tarefa.classe])).toEqual([
      ["INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", "PROVIDENCIA"],
      ["2. REVISAR", null],
    ]);
  });
});

describe("regra da insolvência: Enviar e Revisar 2 dias úteis antes (pedido de 11/11/2026)", () => {
  // Tipos como no catálogo do SAMA em 11/11/2026: prazo do tipo no VIOS e o 3. PROTOCOLAR do fluxo.
  const ARVORE_INS = new Map<number, TipoNaArvore>([
    [5, { nome: "CONTESTAÇÃO", prazo: "12 dias", criacao: [321, 314, 313], conclusao: [] }],
    [238, { nome: "CUMPRIMENTO DE SENTENÇA", prazo: null, criacao: [321, 314, 313], conclusao: [], regraPrazo: { dias: 17, negativo: false, corridos: false } }],
    [452, { nome: "COMPROVAR PAGAMENTO", prazo: "2 dias", criacao: [321, 314, 313], conclusao: [] }],
    [473, { nome: "MANDADO DE SEGURANÇA", prazo: null, criacao: [321, 314, 313], conclusao: [] }],
    [462, { nome: "EMBARGOS DE DECLARAÇÃO", prazo: null, criacao: [314, 313], conclusao: [], regraPrazo: { dias: 12, negativo: true, corridos: false } }],
    [612, { nome: "MANIFESTAÇÃO - FLUXO D5", prazo: null, criacao: [321, 314, 482], conclusao: [] }],
    [622, { nome: "AGRAVO DE INSTRUMENTO", prazo: "10 dias", criacao: [321, 314, 482], conclusao: [] }],
    [321, { nome: "1. CIÊNCIA DOS AGENDAMENTOS", prazo: null, criacao: [], conclusao: [] }],
    [314, { nome: "2. REVISAR", prazo: "1 dia", criacao: [], conclusao: [] }],
    [313, { nome: "3. PROTOCOLAR", prazo: "2 dias", criacao: [], conclusao: [] }],
    [482, { nome: "3. PROTOCOLAR", prazo: "4 dias", criacao: [], conclusao: [] }],
  ]);
  const todos = [...ARVORE_INS.keys()];
  const cadeia = (id: string, area: string | null) => cadeiaDoFluxo(montarFluxo(id, arvoreDaArea(ARVORE_INS, todos, area)));
  // Consciência Negra (20/11/2026).
  const ehDiaUtil = criarCalendario(["2026-11-20"]);

  it("na Insolvência e na Cível | Insolvência, a tarefa compartilhada de 10+ dias fica como a MANIFESTAÇÃO - FLUXO D5", () => {
    expect(cadeia("5", "Insolvência")).toEqual({ revisar: 1, protocolar: 4, antecipada: 2 });
    expect(cadeia("5", "Cível | Insolvência")).toEqual({ revisar: 1, protocolar: 4, antecipada: 2 });
    // O prazo lido da aba Prazos vale como o do texto da árvore.
    expect(cadeia("238", "Insolvência")).toEqual({ revisar: 1, protocolar: 4, antecipada: 2 });
    expect(cadeia("612", "Insolvência")).toEqual({ revisar: 1, protocolar: 4 });
  });

  it("exemplo do pedido: fatal 23/11 → Enviar 13/11, Revisar 16/11, Protocolar 19/11 (no Cível, 17, 18 e 19/11)", () => {
    const pick = (datas: ReturnType<typeof datasDoPrazo>) => [datas.enviar, datas.revisar, datas.protocolar];
    expect(pick(datasDoPrazo("2026-11-23", ehDiaUtil, cadeia("5", "Insolvência"), "2026-11-11"))).toEqual(["2026-11-13", "2026-11-16", "2026-11-19"]);
    expect(pick(datasDoPrazo("2026-11-23", ehDiaUtil, cadeia("612", "Insolvência"), "2026-11-11"))).toEqual(["2026-11-13", "2026-11-16", "2026-11-19"]);
    expect(pick(datasDoPrazo("2026-11-23", ehDiaUtil, cadeia("5", "Cível"), "2026-11-11"))).toEqual(["2026-11-17", "2026-11-18", "2026-11-19"]);
  });

  it("nas outras áreas, ou sem a área, fica como o VIOS cria", () => {
    expect(cadeia("5", "Cível")).toEqual({ revisar: 1, protocolar: 2 });
    expect(cadeia("5", "Trabalhista")).toEqual({ revisar: 1, protocolar: 2 });
    expect(cadeia("5", null)).toEqual({ revisar: 1, protocolar: 2 });
    expect(cadeiaDoFluxo(montarFluxo("5", arvoreDaArea(ARVORE_INS, null, "Insolvência")))).toEqual({ revisar: 1, protocolar: 2 });
  });

  it("não vale para prazo do VIOS menor que 10 dias, sem prazo ou negativo", () => {
    expect(cadeia("452", "Insolvência")).toEqual({ revisar: 1, protocolar: 2 });
    expect(cadeia("473", "Insolvência")).toEqual({ revisar: 1, protocolar: 2 });
    expect(cadeia("462", "Insolvência")).toEqual({ revisar: 1, protocolar: 2 });
  });

  it("o tipo que já tem o Protocolar 4 dias depois do Enviar não antecipa de novo", () => {
    expect(cadeia("622", "Insolvência")).toEqual({ revisar: 1, protocolar: 4 });
    expect(montarFluxo("622", arvoreDaArea(ARVORE_INS, todos, "Insolvência"))?.antecipaEnviar).toBeUndefined();
  });
});
