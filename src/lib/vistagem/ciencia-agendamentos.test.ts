import { describe, expect, it } from "vitest";
import {
  cienciaDosAgendamentos,
  cienciaQueFica,
  criadaPeloFluxoDeOutra,
  dataDaCienciaNaVistagem,
  dataDaCienciaNoEnvio,
  ehCienciaDosAgendamentos,
  ehEmbargosDeDeclaracao,
  embargosQueFica,
  fluxoCriaCiencia,
  repetidaDoCaminho,
  repetidasNaVistagem,
  textoDaRepetida,
  vaiDiretoAoRobo,
  type TarefaParaCiencia,
} from "./ciencia-agendamentos";
import { criarCalendario } from "./dias-uteis";
import type { FluxoDaTarefa, TarefaDoFluxo } from "./fluxo-vios";

function noFluxo(nome: string, filhas: TarefaDoFluxo[] = []): TarefaDoFluxo {
  return { id: nome, nome, prazo: null, papel: "responsavel", tambemCria: [], aoConcluir: [], regra: null, responsabilidade: null, filhas };
}

const FLUXOS: Record<string, FluxoDaTarefa> = {
  // Agravo de Petição: cria a Ciência junto.
  "155": { criacao: [noFluxo("1. CIÊNCIA DOS AGENDAMENTOS"), noFluxo("2. REVISAR"), noFluxo("3. PROTOCOLAR")], conclusao: [] },
  // Sessão de Julgamento: cria outras, sem a Ciência.
  "406": { criacao: [noFluxo("INFORMAR CLIENTE")], conclusao: [] },
  // Ciência só dentro de uma filha (fluxo dentro do fluxo).
  "202": { criacao: [noFluxo("CONTESTAÇÃO", [noFluxo("1. CIÊNCIA DOS AGENDAMENTOS")])], conclusao: [] },
};
const fluxoDe = (id: string) => FLUXOS[id] ?? null;

const ADVOGADA = { id: "100", nome: "Advogada Exemplo" };
const ESTAGIARIA = { id: "298", nome: "Estagiária Exemplo" };
const REVISOR = { id: "200", nome: "Revisor Exemplo" };

function tarefa(nome: string, tarefaId: string | null, extra: Partial<TarefaParaCiencia> = {}): TarefaParaCiencia {
  return { tarefa: nome, tarefaId, responsaveis: [ADVOGADA], revisor: REVISOR, ...extra };
}

const opcoes = (area: string) => ({ fluxoDe, area, ehEstagiario: (pessoa: { id: string | null }) => pessoa.id === ESTAGIARIA.id });

describe("ehCienciaDosAgendamentos / fluxoCriaCiencia", () => {
  it("reconhece o tipo pelo nome, com ou sem o número e os acentos", () => {
    expect(ehCienciaDosAgendamentos("1. CIÊNCIA DOS AGENDAMENTOS")).toBe(true);
    expect(ehCienciaDosAgendamentos("ciencia dos agendamentos")).toBe(true);
    expect(ehCienciaDosAgendamentos("CIÊNCIA NF")).toBe(false);
  });

  it("procura a Ciência em qualquer nível do que o fluxo cria junto", () => {
    expect(fluxoCriaCiencia(FLUXOS["155"])).toBe(true);
    expect(fluxoCriaCiencia(FLUXOS["202"])).toBe(true);
    expect(fluxoCriaCiencia(FLUXOS["406"])).toBe(false);
    expect(fluxoCriaCiencia(null)).toBe(false);
  });
});

describe("cienciaQueFica (uma Ciência só por vistagem)", () => {
  const ciencia = () => noFluxo("1. CIÊNCIA DOS AGENDAMENTOS");
  // Apelação: o Embargos (com a Ciência dele) vem antes, na ordem do fluxo, da Ciência da própria Apelação.
  const apelacao: FluxoDaTarefa = { criacao: [noFluxo("2. REVISAR"), noFluxo("EMBARGOS DE DECLARAÇÃO", [ciencia()]), ciencia()], conclusao: [] };

  it("no fluxo de uma tarefa, fica a mais perto dela", () => {
    expect(cienciaQueFica([{ chave: 1, nome: "APELAÇÃO", fluxo: apelacao }])).toEqual({ chave: 1, caminho: ["1. CIÊNCIA DOS AGENDAMENTOS"] });
  });

  it("entre as tarefas, fica a da primeira incluída que cria (ou é) a Ciência", () => {
    expect(
      cienciaQueFica([
        { chave: "a", nome: "INFORMAR CLIENTE", fluxo: null },
        { chave: "b", nome: "CONTESTAÇÃO", fluxo: FLUXOS["202"] },
        { chave: "c", nome: "APELAÇÃO", fluxo: apelacao },
      ])
    ).toEqual({ chave: "b", caminho: ["CONTESTAÇÃO", "1. CIÊNCIA DOS AGENDAMENTOS"] });
    expect(cienciaQueFica([{ chave: "a", nome: "1. CIÊNCIA DOS AGENDAMENTOS", fluxo: null }, { chave: "b", nome: "APELAÇÃO", fluxo: apelacao }])).toEqual({
      chave: "a",
      caminho: null,
    });
    expect(cienciaQueFica([{ chave: "a", nome: "INFORMAR CLIENTE", fluxo: FLUXOS["406"] }])).toBeNull();
  });
});

describe("Embargos de Declaração repetido (um só por vistagem)", () => {
  const ciencia = () => noFluxo("1. CIÊNCIA DOS AGENDAMENTOS");
  // Como no VIOS (vios_fluxos_tarefas, 17/11/2026): o Embargos 462 cria o 2. REVISAR e o 3. PROTOCOLAR dele.
  const embargos462 = () => noFluxo("EMBARGOS DE DECLARAÇÃO", [noFluxo("2. REVISAR"), noFluxo("3. PROTOCOLAR")]);
  const airr: FluxoDaTarefa = {
    criacao: [embargos462(), ciencia(), noFluxo("2. REVISAR"), noFluxo("INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA"), noFluxo("3. PROTOCOLAR")],
    conclusao: [],
  };
  const agravoInterno: FluxoDaTarefa = { criacao: [embargos462(), ciencia(), noFluxo("2. REVISAR"), noFluxo("3. PROTOCOLAR")], conclusao: [] };
  // O Embargos 19 (do Agravo de Instrumento) cria a Ciência dele.
  const embargos19: FluxoDaTarefa = { criacao: [ciencia(), noFluxo("2. REVISAR"), noFluxo("3. PROTOCOLAR")], conclusao: [] };
  const soEmbargosComCiencia: FluxoDaTarefa = { criacao: [noFluxo("EMBARGOS DE DECLARAÇÃO", [ciencia(), noFluxo("2. REVISAR")])], conclusao: [] };

  it("reconhece o Embargos pelo nome, e não a Resposta aos Embargos", () => {
    expect(ehEmbargosDeDeclaracao("EMBARGOS DE DECLARAÇÃO")).toBe(true);
    expect(ehEmbargosDeDeclaracao("Embargos de declaracao")).toBe(true);
    expect(ehEmbargosDeDeclaracao("RESPOSTA AOS EMBARGOS DE DECLARAÇÃO")).toBe(false);
  });

  it("AIRR e AGRAVO INTERNO: fica o Embargos do AIRR; o do Agravo Interno sai com o Revisar e o Protocolar dele", () => {
    const tarefas = [
      { chave: "airr", nome: "AIRR", fluxo: airr },
      { chave: "agravo", nome: "AGRAVO INTERNO", fluxo: agravoInterno },
    ];
    expect(embargosQueFica(tarefas)).toEqual({ chave: "airr", caminho: ["EMBARGOS DE DECLARAÇÃO"] });
    const repetida = repetidasNaVistagem(tarefas);
    // Do AIRR, nada sai.
    expect(repetida("airr", null)).toBe(false);
    expect(repetida("airr", ["EMBARGOS DE DECLARAÇÃO"])).toBe(false);
    expect(repetida("airr", ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"])).toBe(false);
    expect(repetida("airr", ["1. CIÊNCIA DOS AGENDAMENTOS"])).toBe(false);
    // Do Agravo Interno: o Embargos com o que ele cria e a Ciência; o Revisar e o Protocolar do próprio Agravo ficam.
    expect(repetida("agravo", null)).toBe(false);
    expect(repetida("agravo", ["EMBARGOS DE DECLARAÇÃO"])).toBe(true);
    expect(repetida("agravo", ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"])).toBe(true);
    expect(repetida("agravo", ["EMBARGOS DE DECLARAÇÃO", "3. PROTOCOLAR"])).toBe(true);
    expect(repetida("agravo", ["1. CIÊNCIA DOS AGENDAMENTOS"])).toBe(true);
    expect(repetida("agravo", ["2. REVISAR"])).toBe(false);
    expect(repetida("agravo", ["3. PROTOCOLAR"])).toBe(false);
  });

  it("vale a ordem em que as tarefas foram incluídas (Agravo Interno antes do Recurso de Revista)", () => {
    const repetida = repetidasNaVistagem([
      { chave: 1, nome: "AGRAVO INTERNO", fluxo: agravoInterno },
      { chave: 2, nome: "RECURSO DE REVISTA", fluxo: airr },
    ]);
    expect(repetida(1, ["EMBARGOS DE DECLARAÇÃO"])).toBe(false);
    expect(repetida(2, ["EMBARGOS DE DECLARAÇÃO"])).toBe(true);
  });

  it("um Embargos só não é repetido", () => {
    const repetida = repetidasNaVistagem([
      { chave: 1, nome: "AIRR", fluxo: airr },
      { chave: 2, nome: "INFORMAR CLIENTE", fluxo: FLUXOS["406"] },
    ]);
    expect(repetida(1, ["EMBARGOS DE DECLARAÇÃO"])).toBe(false);
    expect(repetida(1, ["EMBARGOS DE DECLARAÇÃO", "3. PROTOCOLAR"])).toBe(false);
  });

  it("Embargos pedido na vistagem: fica ele (nunca sai) e o do fluxo é cancelado", () => {
    const tarefas = [
      { chave: 1, nome: "AIRR", fluxo: airr },
      { chave: 2, nome: "EMBARGOS DE DECLARAÇÃO", fluxo: embargos19 },
    ];
    expect(embargosQueFica(tarefas)).toEqual({ chave: 2, caminho: null });
    const repetida = repetidasNaVistagem(tarefas);
    expect(repetida(2, null)).toBe(false);
    expect(repetida(1, ["EMBARGOS DE DECLARAÇÃO"])).toBe(true);
    expect(repetida(1, ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"])).toBe(true);
  });

  it("a Ciência dentro do Embargos repetido sai com ele: fica a de outra tarefa", () => {
    const tarefas = [
      { chave: 1, nome: "RECURSO INOMINADO", fluxo: soEmbargosComCiencia },
      { chave: 2, nome: "EMBARGOS DE DECLARAÇÃO", fluxo: embargos19 },
    ];
    expect(cienciaQueFica(tarefas)).toEqual({ chave: 2, caminho: ["1. CIÊNCIA DOS AGENDAMENTOS"] });
    const repetida = repetidasNaVistagem(tarefas);
    expect(repetida(1, ["EMBARGOS DE DECLARAÇÃO", "1. CIÊNCIA DOS AGENDAMENTOS"])).toBe(true);
    expect(repetida(2, ["1. CIÊNCIA DOS AGENDAMENTOS"])).toBe(false);
  });

  it("a Ciência pedida depois de uma tarefa que já a cria continua repetida", () => {
    const repetida = repetidasNaVistagem([
      { chave: 1, nome: "AIRR", fluxo: airr },
      { chave: 2, nome: "1. CIÊNCIA DOS AGENDAMENTOS", fluxo: null },
    ]);
    expect(repetida(2, null)).toBe(true);
    expect(repetida(1, ["1. CIÊNCIA DOS AGENDAMENTOS"])).toBe(false);
  });

  it("diz qual repetida é, para a tela", () => {
    expect(repetidaDoCaminho(["EMBARGOS DE DECLARAÇÃO"])).toBe("embargos");
    expect(repetidaDoCaminho(["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"])).toBe("do_embargos");
    expect(repetidaDoCaminho(["1. CIÊNCIA DOS AGENDAMENTOS"])).toBe("ciencia");
    expect(textoDaRepetida(["EMBARGOS DE DECLARAÇÃO", "3. PROTOCOLAR"])).toContain("do Embargos repetido");
  });
});

describe("cienciaDosAgendamentos", () => {
  it("Sessão de Julgamento, como a CIÊNCIA NF, não pede a Ciência (nem escolhe o responsável)", () => {
    expect(cienciaDosAgendamentos([tarefa("SESSÃO DE JULGAMENTO", "406")], opcoes("Cível"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("Sessão de Julgamento", null), tarefa("CIÊNCIA NF", "796")], opcoes("Cível"))).toBeNull();
    const outra = { id: "300", nome: "Outra Advogada" };
    expect(
      cienciaDosAgendamentos([tarefa("SESSÃO DE JULGAMENTO", "406"), tarefa("INFORMAR CLIENTE", "412", { responsaveis: [outra] })], opcoes("Cível"))
    ).toEqual({ responsaveis: [outra], revisorNoLugarDe: [] });
  });

  it("não cria quando o fluxo de alguma tarefa já cria a Ciência", () => {
    expect(cienciaDosAgendamentos([tarefa("SESSÃO DE JULGAMENTO", "406"), tarefa("AGRAVO DE PETIÇÃO", "155")], opcoes("Trabalhista"))).toBeNull();
  });

  it("não cria quando o jurídico já agendou a Ciência", () => {
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9"), tarefa("1. CIÊNCIA DOS AGENDAMENTOS", "321")], opcoes("Trabalhista"))).toBeNull();
  });

  it("cria para quem faz o Enviar da primeira tarefa (tipo sem fluxo, como o Informar Cliente)", () => {
    const outra = { id: "300", nome: "Outra Advogada" };
    const resultado = cienciaDosAgendamentos(
      [tarefa("INFORMAR CLIENTE", "414"), tarefa("SESSÃO DE JULGAMENTO", "406", { responsaveis: [outra] })],
      opcoes("Trabalhista")
    );
    expect(resultado).toEqual({ responsaveis: [ADVOGADA], revisorNoLugarDe: [] });
  });

  it("fora da Reestruturação, o estagiário continua com a Ciência", () => {
    const resultado = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA] })], opcoes("Trabalhista"));
    expect(resultado?.responsaveis).toEqual([ESTAGIARIA]);
  });

  it("na Reestruturação, o estagiário dá lugar ao revisor", () => {
    for (const area of ["Insolvência", "Cível | Insolvência"]) {
      const resultado = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA, ADVOGADA] })], opcoes(area));
      expect(resultado).toEqual({ responsaveis: [REVISOR, ADVOGADA], revisorNoLugarDe: [ESTAGIARIA.nome] });
    }
  });

  it("sem revisor na primeira tarefa, usa o de outra tarefa; sem nenhum, fica com o estagiário", () => {
    const semRevisor = cienciaDosAgendamentos(
      [tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA], revisor: null }), tarefa("MANIFESTAÇÃO SOBRE LAUDO PERICIAL", "433")],
      opcoes("Insolvência")
    );
    expect(semRevisor?.responsaveis).toEqual([REVISOR]);
    const nenhum = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA], revisor: null })], opcoes("Insolvência"));
    expect(nenhum).toEqual({ responsaveis: [ESTAGIARIA], revisorNoLugarDe: [] });
  });

  it("não repete a pessoa quando o revisor já é responsável", () => {
    const resultado = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA, REVISOR] })], opcoes("Insolvência"));
    expect(resultado?.responsaveis).toEqual([REVISOR]);
  });

  it("vistagem só com CIÊNCIA NF não leva a Ciência dos Agendamentos", () => {
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9")], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9"), tarefa("CIÊNCIA NF", "9")], opcoes("Insolvência"))).toBeNull();
  });

  it("VERIFICAR RENÚNCIA, como a CIÊNCIA NF, não pede a Ciência (nem escolhe o responsável)", () => {
    expect(cienciaDosAgendamentos([tarefa("VERIFICAR RENÚNCIA", "320")], opcoes("Cível"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("Verificar Renuncia", "320"), tarefa("CIÊNCIA NF", "796")], opcoes("Recuperação de Crédito"))).toBeNull();
    const outra = { id: "300", nome: "Outra Advogada" };
    expect(
      cienciaDosAgendamentos([tarefa("VERIFICAR RENÚNCIA", "320"), tarefa("INFORMAR CLIENTE", "414", { responsaveis: [outra] })], opcoes("Cível"))
    ).toEqual({ responsaveis: [outra], revisorNoLugarDe: [] });
    // As outras de renúncia continuam pedindo a Ciência.
    expect(cienciaDosAgendamentos([tarefa("RENÚNCIA", "736")], opcoes("Cível"))).toEqual({ responsaveis: [ADVOGADA], revisorNoLugarDe: [] });
  });

  it("com CIÊNCIA NF e outra tarefa, a Ciência vai para quem faz o Enviar da outra", () => {
    const outra = { id: "300", nome: "Outra Advogada" };
    const resultado = cienciaDosAgendamentos(
      [tarefa("CIÊNCIA NF", "9"), tarefa("MANIFESTAÇÃO SOBRE LAUDO PERICIAL", "433", { responsaveis: [outra] })],
      opcoes("Trabalhista")
    );
    expect(resultado).toEqual({ responsaveis: [outra], revisorNoLugarDe: [] });
  });

  it("sem tarefa escolhida ou sem responsável, ainda não há o que criar", () => {
    expect(cienciaDosAgendamentos([], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("", null)], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [] })], opcoes("Trabalhista"))).toBeNull();
  });
});

describe("data da Ciência dos Agendamentos (pedido de 13/11/2026)", () => {
  // 20/11/2026 (sexta) é feriado.
  const ehDiaUtil = criarCalendario(["2026-11-20"]);

  it("vistada até as 17h59, fica no próprio dia", () => {
    expect(dataDaCienciaNaVistagem("2026-11-12", 9, ehDiaUtil)).toBe("2026-11-12");
    expect(dataDaCienciaNaVistagem("2026-11-12", 17, ehDiaUtil)).toBe("2026-11-12");
  });

  it("vistada às 18h ou depois, vai para o dia útil seguinte", () => {
    expect(dataDaCienciaNaVistagem("2026-11-12", 18, ehDiaUtil)).toBe("2026-11-13");
    expect(dataDaCienciaNaVistagem("2026-11-12", 23, ehDiaUtil)).toBe("2026-11-13");
    // sexta à noite → segunda
    expect(dataDaCienciaNaVistagem("2026-11-13", 20, ehDiaUtil)).toBe("2026-11-16");
    // quinta à noite, com a sexta feriado → segunda
    expect(dataDaCienciaNaVistagem("2026-11-19", 19, ehDiaUtil)).toBe("2026-11-23");
  });

  it("vistada num dia sem expediente, vai para o próximo dia útil, a qualquer hora", () => {
    expect(dataDaCienciaNaVistagem("2026-11-14", 10, ehDiaUtil)).toBe("2026-11-16");
    expect(dataDaCienciaNaVistagem("2026-11-20", 9, ehDiaUtil)).toBe("2026-11-23");
  });

  it("no envio ao robô, a Ciência com data passada vai com a do envio; a futura e as outras tarefas não mudam", () => {
    expect(dataDaCienciaNoEnvio("1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-12", "2026-11-13")).toBe("2026-11-13");
    expect(dataDaCienciaNoEnvio("1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-16", "2026-11-13")).toBe("2026-11-16");
    expect(dataDaCienciaNoEnvio("1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-13", "2026-11-13")).toBe("2026-11-13");
    expect(dataDaCienciaNoEnvio("INFORMAR CLIENTE", "2026-11-12", "2026-11-13")).toBe("2026-11-12");
  });
});

describe("vaiDiretoAoRobo: Operações Legais só com a VERIFICAR RENÚNCIA (pedido de 18/11/2026)", () => {
  const renuncia = { tarefa: "VERIFICAR RENÚNCIA" };

  it("sozinha na Operações Legais: sem a Conferência", () => {
    expect(vaiDiretoAoRobo("Operações Legais", [renuncia])).toBe(true);
  });

  it("com outra tarefa junto, em outra área ou outra tarefa sozinha: a esteira de sempre", () => {
    expect(vaiDiretoAoRobo("Operações Legais", [renuncia, { tarefa: "CIÊNCIA NF" }])).toBe(false);
    expect(vaiDiretoAoRobo("Trabalhista", [renuncia])).toBe(false);
    expect(vaiDiretoAoRobo(null, [renuncia])).toBe(false);
    expect(vaiDiretoAoRobo("Operações Legais", [{ tarefa: "CIÊNCIA NF" }])).toBe(false);
    expect(vaiDiretoAoRobo("Operações Legais", [])).toBe(false);
  });
});

describe("criadaPeloFluxoDeOutra: tarefa que o fluxo de outra já cria (pedido de 26/11/2026)", () => {
  const doTipo = (id: string, nome: string, filhas: TarefaDoFluxo[] = []): TarefaDoFluxo => ({ ...noFluxo(nome, filhas), id });
  // Como no VIOS: a AUDIÊNCIA UNA/INICIAL (202) cria a CONTESTAÇÃO 418 (com o 2. REVISAR e o 3. PROTOCOLAR dela), a
  // INFORMAR CLIENTE e a Ciência; a AUD. INSTRUÇÃO (457) cria a INFORMAR CLIENTE.
  const AUDIENCIA: FluxoDaTarefa = {
    criacao: [
      doTipo("418", "CONTESTAÇÃO", [doTipo("419", "2. REVISAR"), doTipo("420", "3. PROTOCOLAR")]),
      doTipo("321", "1. CIÊNCIA DOS AGENDAMENTOS"),
      doTipo("412", "INFORMAR CLIENTE"),
    ],
    conclusao: [],
  };
  const CONTESTACAO: FluxoDaTarefa = { criacao: [doTipo("419", "2. REVISAR"), doTipo("420", "3. PROTOCOLAR")], conclusao: [] };
  const item = (chave: string, tarefaId: string | null, nome: string, fluxo: FluxoDaTarefa | null = null) => ({ chave, tarefaId, nome, fluxo });

  it("a AUDIÊNCIA UNA/INICIAL já cria a CONTESTAÇÃO: a CONTESTAÇÃO pedida à parte fica duplicada", () => {
    const criadaPor = criadaPeloFluxoDeOutra([
      item("a", "202", "AUDIÊNCIA UNA/INICIAL", AUDIENCIA),
      item("b", "418", "CONTESTAÇÃO", CONTESTACAO),
    ]);
    expect(criadaPor("b")).toBe("AUDIÊNCIA UNA/INICIAL");
    expect(criadaPor("a")).toBeNull();
  });

  it("vale em qualquer ordem e casa pelo nome quando o id é outro (a lista pode ter outra CONTESTAÇÃO)", () => {
    const criadaPor = criadaPeloFluxoDeOutra([item("b", "5", "Contestação"), item("a", "202", "AUDIÊNCIA UNA/INICIAL", AUDIENCIA)]);
    expect(criadaPor("b")).toBe("AUDIÊNCIA UNA/INICIAL");
    expect(criadaPor("a")).toBeNull();
  });

  it("vale para outros pares da árvore e em qualquer nível do fluxo", () => {
    const impugnacao: FluxoDaTarefa = { criacao: [doTipo("900", "MANIFESTAÇÃO", [doTipo("412", "INFORMAR CLIENTE")])], conclusao: [] };
    const criadaPor = criadaPeloFluxoDeOutra([item("a", "453", "IMPUGNAÇÃO AO LAUDO", impugnacao), item("b", "412", "INFORMAR CLIENTE")]);
    expect(criadaPor("b")).toBe("IMPUGNAÇÃO AO LAUDO");
  });

  it("tarefas sem relação no fluxo ficam", () => {
    const criadaPor = criadaPeloFluxoDeOutra([
      item("a", "202", "AUDIÊNCIA UNA/INICIAL", AUDIENCIA),
      item("b", "136", "MANIFESTAÇÃO - FLUXO D1", CONTESTACAO),
      item("c", null, "COMPROVAR PAGAMENTO"),
    ]);
    expect([criadaPor("a"), criadaPor("b"), criadaPor("c")]).toEqual([null, null, null]);
  });

  it("a Ciência dos Agendamentos e o Embargos de Declaração seguem a regra deles (o robô cancela os do fluxo)", () => {
    const agravo: FluxoDaTarefa = { criacao: [doTipo("462", "EMBARGOS DE DECLARAÇÃO")], conclusao: [] };
    const criadaPor = criadaPeloFluxoDeOutra([
      item("a", "202", "AUDIÊNCIA UNA/INICIAL", AUDIENCIA),
      item("b", "321", "1. CIÊNCIA DOS AGENDAMENTOS"),
      item("c", "465", "AGRAVO INTERNO", agravo),
      item("d", "19", "EMBARGOS DE DECLARAÇÃO"),
    ]);
    expect(criadaPor("b")).toBeNull();
    expect(criadaPor("d")).toBeNull();
  });

  it("duas que se criam uma à outra: fica a primeira", () => {
    const umaCriaOutra = (id: string, nome: string): FluxoDaTarefa => ({ criacao: [doTipo(id, nome)], conclusao: [] });
    const criadaPor = criadaPeloFluxoDeOutra([
      item("a", "1", "TAREFA A", umaCriaOutra("2", "TAREFA B")),
      item("b", "2", "TAREFA B", umaCriaOutra("1", "TAREFA A")),
    ]);
    expect(criadaPor("a")).toBeNull();
    expect(criadaPor("b")).toBe("TAREFA A");
  });
});
