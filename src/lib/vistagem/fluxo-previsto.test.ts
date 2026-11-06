import { describe, expect, it } from "vitest";
import { criarCalendario } from "./dias-uteis";
import { ESTAGIARIO_DA_PASTA, caminhosDoFluxo, emOrdemDeArvore, fluxoParaOVios, fluxoPrevisto, quemFicaNoFluxo } from "./fluxo-previsto";
import { montarFluxo, type BaseDaData, type RegraDePrazo, type ResponsabilidadeDoTipo, type TipoNaArvore } from "./fluxo-vios";

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

  it("estagiário da pasta (Inserir Pauta, Habilitação): o estagiário, como o VIOS cria", () => {
    expect(quemFicaNoFluxo("responsavel", resp([], marcacoes({ estagiario: true })), pessoas)).toBe(ESTAGIARIO_DA_PASTA);
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
      ["HABILITAÇÃO PROCESSUAL", ESTAGIARIO_DA_PASTA],
      ["VERIFICAR ATA", LARISSA],
    ]);
  });
});
