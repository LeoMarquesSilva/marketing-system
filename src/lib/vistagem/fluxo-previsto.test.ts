import { describe, expect, it } from "vitest";
import { criarCalendario, datasDoPrazo } from "./dias-uteis";
import {
  ESTAGIARIO_DA_PASTA,
  arvoreComResponsavelDaArea,
  caminhosDoFluxo,
  comResponsaveisFixosNoFluxo,
  emOrdemDeArvore,
  fluxoDoPrazo,
  fluxoParaOVios,
  fluxoPrevisto,
  prazoApertado,
  prazoMarcadoCurto,
  prazoMarcadoLongo,
  quemFicaNoFluxo,
  responsaveisFixosDoFluxo,
} from "./fluxo-previsto";
import { arvoreDaArea, cadeiaDoFluxo, montarFluxo, type BaseDaData, type RegraDePrazo, type ResponsabilidadeDoTipo, type TipoNaArvore } from "./fluxo-vios";

const uteis = (dias: number, negativo = false): RegraDePrazo => ({ dias, negativo, corridos: false });
const tipo = (
  nome: string,
  regraPrazo: RegraDePrazo | null,
  criacao: [number, BaseDaData][] = [],
  conclusao: number[] = []
): TipoNaArvore => ({
  nome,
  prazo: null,
  criacao: criacao.map(([id]) => id),
  conclusao,
  regraPrazo,
  baseDasFilhas: new Map(criacao),
});

// Recorte da árvore do VIOS com as regras lidas em 04/11/2026 (abas Prazos e Fluxo Automático - Criação).
const ARVORE = new Map<number, TipoNaArvore>([
  [470, tipo("APRESENTAÇÃO/IMPUGNAÇÃO AO IDPJ", uteis(12), [[321, "atual"], [314, "pai"], [414, "atual"], [313, "pai"]])],
  [154, tipo("RECURSO DE REVISTA", uteis(5), [[462, "pai"], [321, "atual"], [314, "pai"], [414, "atual"], [313, "pai"]])],
  [462, tipo("EMBARGOS DE DECLARAÇÃO", uteis(3, true), [[314, "pai"], [313, "pai"]])],
  [202, tipo("AUDIÊNCIA UNA/INICIAL", uteis(0), [[418, "pai"], [321, "atual"], [458, "pai"], [260, "pai"], [417, "atual"]])],
  [418, tipo("CONTESTAÇÃO", uteis(15, true), [[419, "pai"], [420, "pai"]])],
  [419, tipo("2. REVISAR", uteis(6))],
  [420, tipo("3. PROTOCOLAR", uteis(13))],
  [458, tipo("LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO PROCESSUAL", uteis(4, true))],
  [260, tipo("CIÊNCIA ATA + ENVIAR RELATÓRIO", uteis(1))],
  [417, tipo("HABILITAÇÃO PROCESSUAL", uteis(1))],
  [321, tipo("1. CIÊNCIA DOS AGENDAMENTOS", uteis(0))],
  [314, tipo("2. REVISAR", uteis(1))],
  [313, tipo("3. PROTOCOLAR", uteis(2), [], [318])],
  [414, tipo("INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", uteis(1))],
  [318, tipo("4. VALIDAR PROTOCOLO", uteis(0))],
  [316, tipo("CIÊNCIA NF", uteis(0))],
  // Apelação (Cível) cria a Ciência dela e um Embargos de Declaração, que cria outra (lidas em 06/11/2026).
  [36, tipo("APELAÇÃO", uteis(12), [[321, "atual"], [314, "pai"], [313, "pai"], [19, "atual"]])],
  [19, tipo("EMBARGOS DE DECLARAÇÃO", uteis(2), [[321, "atual"], [314, "pai"], [313, "pai"]])],
  // Embargos de Declaração da Insolvência: Protocolar 4 dias úteis depois do Enviar.
  [487, tipo("EMBARGOS DE DECLARAÇÃO", uteis(2), [[321, "atual"], [314, "pai"], [482, "pai"]])],
  [482, tipo("3. PROTOCOLAR", uteis(4))],
  // Sem as regras lidas (catálogo antigo): só o Revisar e o Protocolar ganham data.
  [452, { nome: "COMPROVAR PAGAMENTO", prazo: "2 dias", criacao: [321, 314, 414, 313], conclusao: [], regraPrazo: null, baseDasFilhas: null }],
]);

// Feriados: Consciência Negra (20/11/2026), Sexta-feira Santa (26/03/2027) e Tiradentes (21/04/2027).
const ehDiaUtil = criarCalendario(["2026-11-20", "2027-03-26", "2027-04-21"]);
const pessoas = { responsavel: "Vanessa Lanza Sellani", revisor: "Fernanda Voltarelli Arnoni" };
const datas = (lista: { nome: string; data: string | null; nivel: number }[]) => lista.map((tarefa) => [tarefa.nivel, tarefa.nome, tarefa.data]);

describe("fluxo previsto (regras do VIOS)", () => {
  it("IDPJ do teste de 03/11: igual ao que o VIOS criou (CI 934332)", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-23" }, montarFluxo("470", ARVORE), ehDiaUtil, { hoje: "2026-11-03" });
    expect(datas(previstas)).toEqual([
      [1, "1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-03"],
      [1, "2. REVISAR", "2026-11-24"],
      [1, "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", "2026-11-04"],
      [1, "3. PROTOCOLAR", "2026-11-25"],
    ]);
    expect(previstas.find((tarefa) => tarefa.nome === "3. PROTOCOLAR")?.responsaveis).toBe("Vanessa Lanza Sellani + Samuel Willian Silva");
    expect(previstas.find((tarefa) => tarefa.nome === "2. REVISAR")?.responsaveis).toBe("Fernanda Voltarelli Arnoni");
  });

  it("Recurso de Revista: o Embargos 3 dias úteis antes, e o Revisar e o Protocolar dele (CI 934671)", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-12" }, montarFluxo("154", ARVORE), ehDiaUtil, { hoje: "2026-11-04" });
    expect(datas(previstas).slice(0, 3)).toEqual([
      [1, "EMBARGOS DE DECLARAÇÃO", "2026-11-09"],
      [2, "2. REVISAR", "2026-11-10"],
      [2, "3. PROTOCOLAR", "2026-11-11"],
    ]);
    expect(previstas[1].caminho).toEqual(["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"]);
    expect(previstas.find((tarefa) => tarefa.nivel === 1 && tarefa.nome === "3. PROTOCOLAR")?.data).toBe("2026-11-16");
  });

  it("Audiência UNA/Inicial de 22/04/2027: Contestação 15 dias úteis antes, lembrete 4 antes, ata depois", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2027-04-22" }, montarFluxo("202", ARVORE), ehDiaUtil, { hoje: "2026-11-04" });
    expect(datas(previstas)).toEqual([
      [1, "CONTESTAÇÃO", "2027-03-31"],
      [2, "2. REVISAR", "2027-04-08"],
      [2, "3. PROTOCOLAR", "2027-04-19"],
      [1, "1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-04"],
      [1, "LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO PROCESSUAL", "2027-04-15"],
      [1, "CIÊNCIA ATA + ENVIAR RELATÓRIO", "2027-04-23"],
      [1, "HABILITAÇÃO PROCESSUAL", "2026-11-05"],
    ]);
  });

  it("data mudada pelo jurídico: as filhas acompanham, e o robô recebe o que difere do VIOS", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2027-04-22" }, montarFluxo("202", ARVORE), ehDiaUtil, {
      hoje: "2026-11-04",
      datas: [{ caminho: ["CONTESTAÇÃO"], data: "2027-03-24" }],
    });
    const contestacao = previstas.find((tarefa) => tarefa.nome === "CONTESTAÇÃO");
    expect(contestacao).toMatchObject({ data: "2027-03-24", dataVios: "2027-03-31", editada: true });
    // 26/03/2027 (Sexta-feira Santa) não conta.
    expect(previstas.find((tarefa) => tarefa.caminho.join(">") === "CONTESTAÇÃO>2. REVISAR")).toMatchObject({
      data: "2027-04-02",
      dataVios: "2027-04-08",
      editada: false,
    });
    expect(fluxoParaOVios(previstas)).toEqual([
      { caminho: ["CONTESTAÇÃO"], data: "2027-03-24" },
      { caminho: ["CONTESTAÇÃO", "2. REVISAR"], data: "2027-04-02" },
      { caminho: ["CONTESTAÇÃO", "3. PROTOCOLAR"], data: "2027-04-13" },
    ]);
  });

  it("responsáveis escolhidos pelo jurídico ficam no lugar da regra do robô e vão para o robô, com ou sem data", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-17" }, montarFluxo("36", ARVORE), ehDiaUtil, {
      hoje: "2026-11-06",
      datas: [
        { caminho: ["2. REVISAR"], responsaveis: ["Leticia Zamarion Julio"] },
        { caminho: ["EMBARGOS DE DECLARAÇÃO", "3. PROTOCOLAR"], data: "2026-11-16", responsaveis: ["Leticia Zamarion Julio", "Samuel Willian Silva"] },
      ],
    });
    const revisar = previstas.find((tarefa) => tarefa.caminho.join(">") === "2. REVISAR");
    expect(revisar).toMatchObject({
      responsaveis: "Leticia Zamarion Julio",
      responsaveisEscolhidos: ["Leticia Zamarion Julio"],
      responsaveisPadrao: "Fernanda Voltarelli Arnoni",
      editada: false,
    });
    // Sem escolha, a regra do robô (Protocolar: o responsável e o Samuel).
    const protocolar = previstas.find((tarefa) => tarefa.caminho.join(">") === "3. PROTOCOLAR");
    expect(protocolar?.responsaveisEscolhidos).toBeUndefined();
    expect(protocolar?.responsaveis).toMatch(/^Vanessa Lanza Sellani \+ /);
    expect(fluxoParaOVios(previstas)).toEqual([
      { caminho: ["2. REVISAR"], responsaveis: ["Leticia Zamarion Julio"] },
      { caminho: ["EMBARGOS DE DECLARAÇÃO", "3. PROTOCOLAR"], data: "2026-11-16", responsaveis: ["Leticia Zamarion Julio", "Samuel Willian Silva"] },
    ]);
    // A Ciência repetida o robô cancela: o responsável escolhido nela não vai.
    const comCiencia = fluxoPrevisto({ ...pessoas, data: "2026-11-17" }, montarFluxo("36", ARVORE), ehDiaUtil, {
      hoje: "2026-11-06",
      datas: [{ caminho: ["EMBARGOS DE DECLARAÇÃO", "1. CIÊNCIA DOS AGENDAMENTOS"], responsaveis: ["Leticia Zamarion Julio"] }],
    }).map((tarefa) => (tarefa.caminho.length === 2 && tarefa.nome.startsWith("1. CIÊNCIA") ? { ...tarefa, repetida: true } : tarefa));
    expect(fluxoParaOVios(comCiencia)).toEqual([]);
  });

  it("sem as regras lidas, só o Revisar e o Protocolar têm data (conta antiga)", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-09" }, montarFluxo("452", ARVORE), ehDiaUtil, { hoje: "2026-11-04" });
    expect(datas(previstas)).toEqual([
      [1, "1. CIÊNCIA DOS AGENDAMENTOS", null],
      [1, "2. REVISAR", "2026-11-10"],
      [1, "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", null],
      [1, "3. PROTOCOLAR", "2026-11-11"],
    ]);
    expect(fluxoParaOVios(previstas)).toEqual([]);
  });

  it("em árvore: as tarefas que o Embargos cria ficam embaixo dele, mesmo fora da ordem das datas", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-17" }, montarFluxo("36", ARVORE), ehDiaUtil, { hoje: "2026-11-06" });
    expect(datas(emOrdemDeArvore(previstas))).toEqual([
      [1, "1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-06"],
      [1, "EMBARGOS DE DECLARAÇÃO", "2026-11-10"],
      [2, "1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-06"],
      [2, "2. REVISAR", "2026-11-11"],
      [2, "3. PROTOCOLAR", "2026-11-12"],
      [1, "2. REVISAR", "2026-11-18"],
      [1, "3. PROTOCOLAR", "2026-11-19"],
    ]);
  });

  it("prazo curto: o Revisar e o Protocolar vão nas datas apertadas e o robô as grava no VIOS", () => {
    // Embargos de 5 dias corridos, fatal 10/11, vistado em 06/11: Enviar hoje, Revisar e Protocolar 09/11.
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-06" }, montarFluxo("487", ARVORE), ehDiaUtil, {
      hoje: "2026-11-06",
      apertada: { revisar: "2026-11-09", protocolar: "2026-11-09" },
    });
    expect(previstas.find((tarefa) => tarefa.nome === "2. REVISAR")).toMatchObject({ data: "2026-11-09", dataVios: "2026-11-09" });
    expect(previstas.find((tarefa) => tarefa.nome === "2. REVISAR")?.ajustada).toBeUndefined();
    expect(previstas.find((tarefa) => tarefa.nome === "3. PROTOCOLAR")).toMatchObject({ data: "2026-11-09", dataVios: "2026-11-12", ajustada: "fatal", editada: false });
    expect(fluxoParaOVios(previstas)).toEqual([{ caminho: ["3. PROTOCOLAR"], data: "2026-11-09" }]);
    // A data escolhida pelo jurídico continua valendo.
    const escolhida = fluxoPrevisto({ ...pessoas, data: "2026-11-06" }, montarFluxo("487", ARVORE), ehDiaUtil, {
      hoje: "2026-11-06",
      apertada: { revisar: "2026-11-09", protocolar: "2026-11-09" },
      datas: [{ caminho: ["3. PROTOCOLAR"], data: "2026-11-06" }],
    });
    expect(escolhida.find((tarefa) => tarefa.nome === "3. PROTOCOLAR")).toMatchObject({ data: "2026-11-06", editada: true });
  });

  it("nenhuma tarefa do fluxo fica antes de hoje: a regra do VIOS que dá data passada vai para hoje", () => {
    // Lembrete 4 dias úteis antes de uma audiência daqui a 2 dias úteis: o VIOS daria ontem.
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-10" }, montarFluxo("202", ARVORE), ehDiaUtil, { hoje: "2026-11-06" });
    expect(previstas.find((tarefa) => tarefa.nome.startsWith("LEMBRETE"))).toMatchObject({ data: "2026-11-06", dataVios: "2026-11-04", ajustada: "hoje" });
    expect(previstas.find((tarefa) => tarefa.nome === "CONTESTAÇÃO")).toMatchObject({ data: "2026-11-06", ajustada: "hoje" });
    // As filhas da Contestação contam da data nova (hoje).
    expect(previstas.find((tarefa) => tarefa.caminho.join(">") === "CONTESTAÇÃO>2. REVISAR")?.data).toBe("2026-11-16");
    expect(fluxoParaOVios(previstas).map((item) => item.caminho.join(">"))).toEqual(
      expect.arrayContaining(["CONTESTAÇÃO", "LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO PROCESSUAL"])
    );
  });

  it("a Ciência repetida não vai nas datas para o robô", () => {
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-17" }, montarFluxo("36", ARVORE), ehDiaUtil, {
      hoje: "2026-11-06",
      datas: [{ caminho: ["EMBARGOS DE DECLARAÇÃO", "1. CIÊNCIA DOS AGENDAMENTOS"], data: "2026-11-09" }],
    }).map((tarefa) => (tarefa.nivel === 2 && tarefa.nome.startsWith("1. CI") ? { ...tarefa, repetida: true } : tarefa));
    expect(fluxoParaOVios(previstas)).toEqual([]);
  });

  it("sem fluxo não cria nada; os caminhos aceitos incluem o fluxo dentro do fluxo", () => {
    expect(fluxoPrevisto({ ...pessoas, data: "2026-11-04" }, montarFluxo("316", ARVORE), ehDiaUtil, { hoje: "2026-11-04" })).toEqual([]);
    expect(fluxoPrevisto({ ...pessoas, data: "2026-11-04" }, null, ehDiaUtil, { hoje: "2026-11-04" })).toEqual([]);
    const caminhos = caminhosDoFluxo(montarFluxo("154", ARVORE));
    expect(caminhos.has("EMBARGOS DE DECLARACAO > 2. REVISAR")).toBe(true);
    expect(caminhos.has("4. VALIDAR PROTOCOLO")).toBe(false);
  });
});

describe("quem fica nas tarefas do fluxo (regra do robô, sama-rpa regras-fluxo.js)", () => {
  const LARISSA = "Larissa de Oliveira Pereira";
  const marcacoes = (extra: Partial<NonNullable<ResponsabilidadeDoTipo["regras"]>> = {}) => ({
    advogado: false,
    auxiliar: false,
    estagiario: false,
    coordenador: false,
    grupo: false,
    ...extra,
  });
  const resp = (fixos: string[], regras: ResponsabilidadeDoTipo["regras"]): ResponsabilidadeDoTipo => ({ fixos, regras });

  it("Verificar Ata (Larissa fixa, sem a regra do advogado): a Larissa, como o VIOS cria", () => {
    expect(quemFicaNoFluxo("responsavel", resp([LARISSA], marcacoes()), pessoas)).toBe(LARISSA);
  });

  it("só os fixos lidos (catálogo antes da 0060): ficam os fixos", () => {
    expect(quemFicaNoFluxo("responsavel", resp([LARISSA], null), pessoas)).toBe(LARISSA);
    expect(quemFicaNoFluxo("responsavel", resp([], null), pessoas)).toBe("Vanessa Lanza Sellani");
  });

  it("estagiário da pasta (Inserir Pauta, Habilitação): o estagiário, como o VIOS cria; sem estagiário, o responsável", () => {
    expect(quemFicaNoFluxo("responsavel", resp([], marcacoes({ estagiario: true })), pessoas)).toBe(
      `${ESTAGIARIO_DA_PASTA} (sem estagiário, Vanessa Lanza Sellani)`
    );
  });

  it("regra do advogado com fixos ou estagiário: o responsável da vistagem e quem o VIOS põe", () => {
    expect(quemFicaNoFluxo("responsavel", resp([LARISSA], marcacoes({ advogado: true, estagiario: true })), pessoas)).toBe(
      `Vanessa Lanza Sellani, ${LARISSA}, ${ESTAGIARIO_DA_PASTA}`
    );
  });

  it("só a regra do advogado, ou sem cadastro lido: o responsável da vistagem", () => {
    expect(quemFicaNoFluxo("responsavel", resp([], marcacoes({ advogado: true })), pessoas)).toBe("Vanessa Lanza Sellani");
    expect(quemFicaNoFluxo("responsavel", null, pessoas)).toBe("Vanessa Lanza Sellani");
  });

  it("só a regra do auxiliar: o revisor da vistagem", () => {
    expect(quemFicaNoFluxo("responsavel", resp([], marcacoes({ auxiliar: true })), pessoas)).toBe("Fernanda Voltarelli Arnoni");
  });

  it("Revisar e Protocolar não mudam: revisor; responsável e Samuel", () => {
    expect(quemFicaNoFluxo("revisor", resp([LARISSA], marcacoes()), pessoas)).toBe("Fernanda Voltarelli Arnoni");
    expect(quemFicaNoFluxo("protocolar", resp([], marcacoes({ advogado: true })), pessoas)).toBe("Vanessa Lanza Sellani + Samuel Willian Silva");
  });

  it("Audiência UNA/Inicial (0013471-96): Verificar Ata com a Larissa e a Habilitação com o estagiário", () => {
    const arvore = new Map<number, TipoNaArvore>([
      [202, tipo("AUDIÊNCIA UNA/INICIAL", uteis(0), [[321, "atual"], [417, "atual"], [460, "pai"]])],
      [321, { ...tipo("1. CIÊNCIA DOS AGENDAMENTOS", uteis(0)), responsabilidade: resp([], marcacoes({ advogado: true })) }],
      [417, { ...tipo("HABILITAÇÃO PROCESSUAL", uteis(1)), responsabilidade: resp([], marcacoes({ estagiario: true })) }],
      [460, { ...tipo("VERIFICAR ATA", uteis(1)), responsabilidade: resp([LARISSA], marcacoes()) }],
    ]);
    const previstas = fluxoPrevisto(
      { data: "2027-03-04", responsavel: "Pamela Klava Senna Patricio", revisor: null },
      montarFluxo("202", arvore),
      ehDiaUtil,
      { hoje: "2026-11-05" }
    );
    expect(previstas.map((tarefa) => [tarefa.nome, tarefa.responsaveis])).toEqual([
      ["1. CIÊNCIA DOS AGENDAMENTOS", "Pamela Klava Senna Patricio"],
      ["HABILITAÇÃO PROCESSUAL", `${ESTAGIARIO_DA_PASTA} (sem estagiário, Pamela Klava Senna Patricio)`],
      ["VERIFICAR ATA", LARISSA],
    ]);
  });
});

describe("prazoApertado", () => {
  // Embargos de 5 dias corridos: o Protocolar é 4 dias úteis depois do Enviar. Fatal 10/11, hoje 06/11.
  const embargos = montarFluxo("487", ARVORE);
  const prazo = { etiqueta: "PRAZO", dataFatal: "2026-11-10" };

  it("prazo curto: o Enviar vai hoje e o Protocolar 1 dia útil antes da fatal", () => {
    expect(prazoApertado(prazo, embargos, ehDiaUtil, "2026-11-06")).toMatchObject({ enviar: "2026-11-06", protocolar: "2026-11-09" });
  });

  it("a data gravada de hoje ou de antes (validada noutro dia) continua apertando", () => {
    expect(prazoApertado({ ...prazo, data: "2026-11-06" }, embargos, ehDiaUtil, "2026-11-06")?.enviar).toBe("2026-11-06");
    expect(prazoApertado({ ...prazo, data: "2026-11-05" }, embargos, ehDiaUtil, "2026-11-06")?.enviar).toBe("2026-11-06");
  });

  it("o Enviar escolhido à mão na Conferência, depois de hoje, vale como está", () => {
    expect(prazoApertado({ ...prazo, data: "2026-11-09" }, embargos, ehDiaUtil, "2026-11-06")).toBeNull();
  });

  it("o prazo que cabe não aperta, nem outra classe de tarefa", () => {
    expect(prazoApertado({ etiqueta: "PRAZO", dataFatal: "2026-12-10" }, embargos, ehDiaUtil, "2026-11-06")).toBeNull();
    expect(prazoApertado({ etiqueta: "PROVIDENCIA", dataFatal: null }, embargos, ehDiaUtil, "2026-11-06")).toBeNull();
  });
});

describe("regra da insolvência no fluxo e no robô (pedido de 11/11/2026)", () => {
  // CONTESTAÇÃO compartilhada (prazo de 12 dias no VIOS, Protocolar 2 dias úteis depois do Enviar). Fatal 23/11/2026.
  const arvore = new Map(ARVORE).set(5, tipo("CONTESTAÇÃO", uteis(12), [[321, "atual"], [314, "pai"], [313, "pai"]]));
  const todos = [...arvore.keys()];
  const contestacao = (area: string) => montarFluxo("5", arvoreDaArea(arvore, todos, area));
  const prazo = { etiqueta: "PRAZO", dataFatal: "2026-11-23" };
  const naInsolvencia = contestacao("Insolvência");
  const doFluxo = (previstas: ReturnType<typeof fluxoPrevisto>, nome: string) => previstas.find((tarefa) => tarefa.nome === nome);

  it("vistada em 11/11: Enviar 13/11 e Revisar 16/11 pelo VIOS; o Protocolar fica em 19/11 e o robô grava", () => {
    const enviar = datasDoPrazo(prazo.dataFatal, ehDiaUtil, cadeiaDoFluxo(naInsolvencia), "2026-11-11").enviar;
    expect(enviar).toBe("2026-11-13");
    const ajuste = prazoApertado({ ...prazo, data: enviar }, naInsolvencia, ehDiaUtil, "2026-11-11");
    expect(ajuste).toEqual({ enviar: "2026-11-13", revisar: null, protocolar: "2026-11-19", motivo: "antecipada" });
    const previstas = fluxoPrevisto({ ...pessoas, data: enviar }, naInsolvencia, ehDiaUtil, { hoje: "2026-11-11", apertada: ajuste });
    expect(doFluxo(previstas, "2. REVISAR")).toMatchObject({ data: "2026-11-16", dataVios: "2026-11-16" });
    expect(doFluxo(previstas, "2. REVISAR")?.ajustada).toBeUndefined();
    expect(doFluxo(previstas, "3. PROTOCOLAR")).toMatchObject({ data: "2026-11-19", dataVios: "2026-11-17", ajustada: "antecipada", editada: false });
    expect(fluxoParaOVios(previstas)).toEqual([{ caminho: ["3. PROTOCOLAR"], data: "2026-11-19" }]);
  });

  it("no Cível nada muda: Enviar 17/11, Revisar 18/11, Protocolar 19/11, como o VIOS cria", () => {
    const civel = contestacao("Cível");
    expect(datasDoPrazo(prazo.dataFatal, ehDiaUtil, cadeiaDoFluxo(civel), "2026-11-11").enviar).toBe("2026-11-17");
    expect(prazoApertado({ ...prazo, data: "2026-11-17" }, civel, ehDiaUtil, "2026-11-11")).toBeNull();
  });

  it("vistada antes da regra (Enviar 17/11): o Protocolar do VIOS já é o 19/11 e o robô não grava nada", () => {
    const ajuste = prazoApertado({ ...prazo, data: "2026-11-17" }, naInsolvencia, ehDiaUtil, "2026-11-11");
    const previstas = fluxoPrevisto({ ...pessoas, data: "2026-11-17" }, naInsolvencia, ehDiaUtil, { hoje: "2026-11-11", apertada: ajuste });
    expect(doFluxo(previstas, "3. PROTOCOLAR")).toMatchObject({ data: "2026-11-19", dataVios: "2026-11-19" });
    expect(doFluxo(previstas, "3. PROTOCOLAR")?.ajustada).toBeUndefined();
    expect(fluxoParaOVios(previstas)).toEqual([]);
  });

  it("sem tempo para antecipar (vistada em 17/11), aperta como o prazo curto", () => {
    expect(prazoApertado(prazo, naInsolvencia, ehDiaUtil, "2026-11-17")).toEqual({ enviar: "2026-11-17", revisar: "2026-11-18", protocolar: "2026-11-19" });
  });

  describe("só com prazo marcado de 10 dias ou mais (correção de 11/11/2026)", () => {
    // Publicação de 11/11/2026; calendário do prazo com a Consciência Negra (20/11).
    const daPublicacao = (contagem: "uteis" | "corridos") => ({ dataPublicacao: "2026-11-11", contagem, ehDiaDePrazo: ehDiaUtil });
    const enviarCom = (prazoMarcado: { dataFatal: string; diasPrazo?: number | null }, contagem: "uteis" | "corridos" = "corridos") =>
      datasDoPrazo(prazoMarcado.dataFatal, ehDiaUtil, cadeiaDoFluxo(fluxoDoPrazo(naInsolvencia, prazoMarcado, daPublicacao(contagem))), "2026-11-11").enviar;

    it("prazo de 5 dias (o teste do AGRAVO RETIDO/INTERNO): fica como o VIOS cria", () => {
      expect(enviarCom({ dataFatal: "2026-11-23", diasPrazo: 5 })).toBe("2026-11-17");
      const curto = fluxoDoPrazo(naInsolvencia, { dataFatal: "2026-11-23", diasPrazo: 5 }, daPublicacao("corridos"));
      expect(curto?.antecipaEnviar).toBeUndefined();
      expect(prazoApertado({ ...prazo, data: "2026-11-17" }, curto, ehDiaUtil, "2026-11-11")).toBeNull();
    });

    it("prazo de 10 dias ou mais pelos botões: antecipa", () => {
      expect(enviarCom({ dataFatal: "2026-11-23", diasPrazo: 10 })).toBe("2026-11-13");
      expect(enviarCom({ dataFatal: "2026-11-23", diasPrazo: 15 })).toBe("2026-11-13");
      expect(prazoMarcadoLongo({ dataFatal: "2026-11-23", diasPrazo: 9 }, null)).toBe(false);
    });

    it("fatal no calendário: conta da publicação até ela, na contagem da área", () => {
      // 10 dias corridos de 11/11 vencem no sábado 21/11 e passam para 23/11; 10 dias úteis vão até 26/11.
      expect(prazoMarcadoLongo({ dataFatal: "2026-11-23" }, daPublicacao("corridos"))).toBe(true);
      expect(prazoMarcadoLongo({ dataFatal: "2026-11-19" }, daPublicacao("corridos"))).toBe(false);
      expect(prazoMarcadoLongo({ dataFatal: "2026-11-23" }, daPublicacao("uteis"))).toBe(false);
      expect(prazoMarcadoLongo({ dataFatal: "2026-11-26" }, daPublicacao("uteis"))).toBe(true);
      expect(enviarCom({ dataFatal: "2026-11-23" }, "corridos")).toBe("2026-11-13");
      expect(enviarCom({ dataFatal: "2026-11-23" }, "uteis")).toBe("2026-11-17");
    });

    it("sem os dias nem a data da publicação, fica como o VIOS cria; nas outras áreas não há o que tirar", () => {
      expect(prazoMarcadoLongo({ dataFatal: "2026-11-23" }, null)).toBe(false);
      const civel = contestacao("Cível");
      expect(fluxoDoPrazo(civel, { dataFatal: "2026-11-23", diasPrazo: 15 }, null)).toBe(civel);
    });
  });

  it("o Enviar escolhido à mão na Conferência vale como está, e o Protocolar continua 1 dia útil antes da fatal", () => {
    expect(prazoApertado({ ...prazo, data: "2026-11-12" }, naInsolvencia, ehDiaUtil, "2026-11-11")).toMatchObject({
      enviar: "2026-11-12",
      protocolar: "2026-11-19",
      motivo: "antecipada",
    });
  });
});

describe("prazo curto na insolvência (pedido de 18/11/2026, 4008806-15: 'pulando 2 dias em prazo de 5 dias')", () => {
  // Fluxo com o 3. PROTOCOLAR de 4 dias (482): o VIOS cria o Enviar 5 dias úteis antes da fatal.
  // A cadeia sai do prazo do catálogo ("4 dias"), como o 3. PROTOCOLAR 482 vem do VIOS.
  const arvore = new Map(ARVORE)
    .set(482, { ...tipo("3. PROTOCOLAR", uteis(4)), prazo: "4 dias" })
    .set(314, { ...tipo("2. REVISAR", uteis(1)), prazo: "1 dia" })
    .set(492, tipo("RESPOSTA AOS EMBARGOS DE DECLARAÇÃO", uteis(2), [[321, "atual"], [314, "pai"], [482, "pai"]]))
    .set(612, tipo("MANIFESTAÇÃO - FLUXO D5", null, [[321, "atual"], [314, "pai"], [482, "pai"]]));
  const todos = [...arvore.keys()];
  const fluxoNa = (id: string, area: string) => montarFluxo(id, arvoreDaArea(arvore, todos, area));
  // Publicada em 17/11/2026, prazo de 5 dias úteis: fatal 25/11 (feriado 20/11).
  const daPublicacao = { dataPublicacao: "2026-11-17", contagem: "uteis" as const, ehDiaDePrazo: ehDiaUtil };
  const prazo = { etiqueta: "PRAZO", dataFatal: "2026-11-25" };
  const cinco = { dataFatal: prazo.dataFatal, diasPrazo: 5 };
  const doFluxo = (previstas: ReturnType<typeof fluxoPrevisto>, nome: string) => previstas.find((tarefa) => tarefa.nome === nome);
  const enviarDe = (fluxo: ReturnType<typeof montarFluxo>, fatal = prazo.dataFatal) => datasDoPrazo(fatal, ehDiaUtil, cadeiaDoFluxo(fluxo), "2026-11-17").enviar;

  it("4008806-15 (5 dias): Enviar 19/11; o VIOS cria o Revisar 23/11 e o robô grava o Protocolar 24/11", () => {
    const fluxo = fluxoDoPrazo(fluxoNa("492", "Cível | Insolvência"), cinco, daPublicacao);
    const enviar = enviarDe(fluxo);
    expect(enviar).toBe("2026-11-19");
    const ajuste = prazoApertado({ ...prazo, data: enviar }, fluxo, ehDiaUtil, "2026-11-17");
    expect(ajuste).toEqual({ enviar: "2026-11-19", revisar: null, protocolar: "2026-11-24", motivo: "adiada" });
    const previstas = fluxoPrevisto({ ...pessoas, data: enviar }, fluxo, ehDiaUtil, { hoje: "2026-11-17", apertada: ajuste });
    expect(doFluxo(previstas, "2. REVISAR")).toMatchObject({ data: "2026-11-23", dataVios: "2026-11-23" });
    expect(doFluxo(previstas, "2. REVISAR")?.ajustada).toBeUndefined();
    // Pela conta do VIOS, o Protocolar cairia depois da fatal (26/11): vai 1 dia útil antes dela.
    expect(doFluxo(previstas, "3. PROTOCOLAR")).toMatchObject({ data: "2026-11-24", dataVios: "2026-11-26", ajustada: "adiada" });
    expect(fluxoParaOVios(previstas)).toEqual([{ caminho: ["3. PROTOCOLAR"], data: "2026-11-24" }]);
  });

  it("os EMBARGOS DE DECLARAÇÃO da insolvência (o caso mais comum, 5 dias) também", () => {
    expect(enviarDe(fluxoDoPrazo(fluxoNa("487", "Insolvência"), cinco, daPublicacao))).toBe("2026-11-19");
  });

  it("com 10 dias ou mais fica como o VIOS cria: Enviar 5 dias úteis antes da fatal", () => {
    const dez = { dataFatal: "2026-12-02", diasPrazo: 10 };
    const fluxo = fluxoDoPrazo(fluxoNa("492", "Cível | Insolvência"), dez, daPublicacao);
    expect(fluxo?.adiaEnviar).toBeUndefined();
    expect(enviarDe(fluxo, dez.dataFatal)).toBe("2026-11-25");
    expect(prazoApertado({ etiqueta: "PRAZO", dataFatal: dez.dataFatal, data: "2026-11-25" }, fluxo, ehDiaUtil, "2026-11-17")).toBeNull();
  });

  it("fatal no calendário: conta da publicação (10 dias úteis de 17/11 vão até 02/12); sem como saber, fica o VIOS", () => {
    expect(prazoMarcadoCurto({ dataFatal: "2026-11-25" }, daPublicacao)).toBe(true);
    expect(prazoMarcadoCurto({ dataFatal: "2026-12-02" }, daPublicacao)).toBe(false);
    expect(prazoMarcadoCurto({ dataFatal: "2026-11-25" }, null)).toBe(false);
    expect(fluxoDoPrazo(fluxoNa("492", "Insolvência"), { dataFatal: "2026-11-25" }, null)?.adiaEnviar).toBeUndefined();
    expect(fluxoDoPrazo(fluxoNa("492", "Insolvência"), { dataFatal: "2026-11-25" }, daPublicacao)?.adiaEnviar).toBe(2);
  });

  it("a MANIFESTAÇÃO - FLUXO D5 e as outras áreas ficam como o VIOS cria, mesmo com 5 dias", () => {
    const d5 = fluxoDoPrazo(fluxoNa("612", "Insolvência"), cinco, daPublicacao);
    expect(d5?.adiaEnviar).toBeUndefined();
    expect(enviarDe(d5)).toBe("2026-11-17");
    const civel = fluxoDoPrazo(fluxoNa("492", "Cível"), cinco, daPublicacao);
    expect(civel?.adiaEnviar).toBeUndefined();
    expect(enviarDe(civel)).toBe("2026-11-17");
  });

  it("o Enviar escolhido à mão na Conferência vale; o Protocolar continua 1 dia útil antes da fatal", () => {
    const fluxo = fluxoDoPrazo(fluxoNa("492", "Insolvência"), cinco, daPublicacao);
    expect(prazoApertado({ ...prazo, data: "2026-11-18" }, fluxo, ehDiaUtil, "2026-11-17")).toEqual({
      enviar: "2026-11-18",
      revisar: null,
      protocolar: "2026-11-24",
      motivo: "adiada",
    });
  });
});

describe("Trabalhista: INSERIR PAUTA do fluxo com a Manoela (pedido de 25/11/2026)", () => {
  // AUD. INSTRUÇÃO (457) cria a INSERIR PAUTA (416) e o INFORMAR CLIENTE; a SESSÃO (406) cria a Ciência (340), que
  // cria a INSERIR PAUTA. O VIOS não fixa ninguém na 416 (vios_tipos_tarefa: sem fixos e sem regras lidas).
  const AUDIENCIA = new Map<number, TipoNaArvore>([
    [457, tipo("AUD. INSTRUÇÃO", null, [[416, "atual"], [409, "atual"]])],
    [416, tipo("INSERIR PAUTA + ATUALIZAR SISTEMA", uteis(1))],
    [409, tipo("INFORMAR CLIENTE", uteis(1))],
    [406, tipo("SESSÃO DE JULGAMENTO", null, [[340, "atual"]])],
    [340, tipo("CIÊNCIA DA PUBLICACÃO E VIABILIDADE SUSTENTACÃO ORAL", uteis(1), [[416, "atual"]])],
  ]);
  const pessoas = { data: "2027-09-30", responsavel: "Pamela Klava Senna Patricio", revisor: null };
  const ehDiaUtil = criarCalendario([]);

  it("na árvore da Trabalhista a INSERIR PAUTA fica com a Manoela; nas outras áreas a árvore não muda", () => {
    const trabalhista = arvoreComResponsavelDaArea(AUDIENCIA, "Trabalhista");
    expect(trabalhista.get(416)?.responsabilidade).toEqual({ fixos: ["Manoela Brisighello Angotti"], regras: null, daArea: true });
    expect(trabalhista.get(409)?.responsabilidade).toBeUndefined();
    for (const area of ["Cível", "Recuperação de Crédito", null]) expect(arvoreComResponsavelDaArea(AUDIENCIA, area)).toBe(AUDIENCIA);
    // O fixo do VIOS vale mais que o da área.
    const comFixoNoVios = new Map(AUDIENCIA).set(416, { ...tipo("INSERIR PAUTA + ATUALIZAR SISTEMA", uteis(1)), responsabilidade: { fixos: ["Outra Pessoa"], regras: null } });
    expect(arvoreComResponsavelDaArea(comFixoNoVios, "Trabalhista").get(416)?.responsabilidade?.fixos).toEqual(["Outra Pessoa"]);
  });

  it("o Fluxo das tarefas da audiência mostra a Manoela na INSERIR PAUTA, e não o advogado do processo", () => {
    const naTrabalhista = fluxoPrevisto(pessoas, montarFluxo("457", arvoreComResponsavelDaArea(AUDIENCIA, "Trabalhista")), ehDiaUtil, { hoje: "2026-11-25" });
    expect(naTrabalhista.map((tarefa) => [tarefa.nome, tarefa.responsaveis])).toEqual([
      ["INSERIR PAUTA + ATUALIZAR SISTEMA", "Manoela Brisighello Angotti"],
      ["INFORMAR CLIENTE", "Pamela Klava Senna Patricio"],
    ]);
    // Fora da Trabalhista, como antes: o responsável da vistagem.
    expect(fluxoPrevisto(pessoas, montarFluxo("457", AUDIENCIA), ehDiaUtil, { hoje: "2026-11-25" })[0].responsaveis).toBe("Pamela Klava Senna Patricio");
  });

  it("vai ao robô como escolhida, também no 2º nível do fluxo; o que o jurídico escolheu vale mais", () => {
    const arvore = arvoreComResponsavelDaArea(AUDIENCIA, "Trabalhista");
    const audiencia = responsaveisFixosDoFluxo(montarFluxo("457", arvore));
    expect(audiencia).toEqual([{ caminho: ["INSERIR PAUTA + ATUALIZAR SISTEMA"], responsaveis: ["Manoela Brisighello Angotti"] }]);
    expect(responsaveisFixosDoFluxo(montarFluxo("406", arvore))).toEqual([
      { caminho: ["CIÊNCIA DA PUBLICACÃO E VIABILIDADE SUSTENTACÃO ORAL", "INSERIR PAUTA + ATUALIZAR SISTEMA"], responsaveis: ["Manoela Brisighello Angotti"] },
    ]);
    expect(responsaveisFixosDoFluxo(montarFluxo("457", AUDIENCIA))).toEqual([]);

    // Junta com o que já ia: data sem pessoa ganha a Manoela; pessoa escolhida fica; o resto entra no fim.
    expect(comResponsaveisFixosNoFluxo([{ caminho: ["INSERIR PAUTA + ATUALIZAR SISTEMA"], data: "2026-11-26" }], audiencia)).toEqual([
      { caminho: ["INSERIR PAUTA + ATUALIZAR SISTEMA"], data: "2026-11-26", responsaveis: ["Manoela Brisighello Angotti"] },
    ]);
    expect(comResponsaveisFixosNoFluxo([{ caminho: ["Inserir Pauta + Atualizar Sistema"], responsaveis: ["Lorena Lourenço Miranda"] }], audiencia)).toEqual([
      { caminho: ["Inserir Pauta + Atualizar Sistema"], responsaveis: ["Lorena Lourenço Miranda"] },
    ]);
    expect(comResponsaveisFixosNoFluxo([{ caminho: ["INFORMAR CLIENTE"], data: "2026-11-27" }], audiencia)).toEqual([
      { caminho: ["INFORMAR CLIENTE"], data: "2026-11-27" },
      ...audiencia,
    ]);
    expect(comResponsaveisFixosNoFluxo([], [])).toEqual([]);
  });
});
