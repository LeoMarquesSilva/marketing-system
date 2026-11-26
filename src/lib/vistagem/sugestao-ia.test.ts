import { describe, expect, it } from "vitest";
import type { AgendamentoValidado, EtiquetaAgendamento, OpcaoTarefa } from "./agendamento";
import { criarCalendarioDePrazo } from "./dias-uteis";
import { ESOCIAL_PADRAO } from "./esocial";
import {
  areaComSugestaoIa,
  compararComSugestao,
  ehAreaTrabalhista,
  costumesDaArea,
  custoDaChamada,
  entradaDaSugestao,
  entradaDoRegistro,
  secaoDoHistorico,
  sugereSoCiencia,
  trechoDecisivo,
  type TarefaDoHistorico,
  esocialDaResposta,
  fatalSugerida,
  instrucoesDaSugestao,
  resultadoDaSugestao,
  sugestaoNaListaAtual,
  sugestaoSemOQueOFluxoCria,
  tarefasDaResposta,
  type RespostaIa,
  type SugestaoIa,
} from "./sugestao-ia";
import type { FluxoDaTarefa, TarefaDoFluxo } from "./fluxo-vios";

const LISTAS: Record<EtiquetaAgendamento, OpcaoTarefa[]> = {
  PRAZO: [
    { id: "452", nome: "COMPROVAR PAGAMENTO" },
    { id: "418", nome: "CONTESTAÇÃO" },
  ],
  PROVIDENCIA: [
    { id: "618", nome: "CIÊNCIA DA MOVIMENTAÇÃO PROCESSUAL" },
    { id: "316", nome: "CIÊNCIA NF" },
    { id: "792", nome: "INSERIR E-SOCIAL" },
  ],
  COMPROMISSO: [{ id: "202", nome: "AUDIÊNCIA UNA/INICIAL" }],
};

const contaPrazo = criarCalendarioDePrazo([]);

function tarefa(item: Partial<RespostaIa["tarefas"][number]>): RespostaIa["tarefas"][number] {
  return { classe: "PRAZO", tarefa_id: "452", dias: null, contagem: null, data: null, hora: null, motivo: "trecho", ...item };
}

describe("Recurso Ordinário vira a tarefa SENTENÇA (fluxo interno)", () => {
  const COM_SENTENCA: Record<EtiquetaAgendamento, OpcaoTarefa[]> = {
    ...LISTAS,
    PRAZO: [...LISTAS.PRAZO, { id: "153", nome: "RECURSO ORDINÁRIO" }, { id: "13", nome: "SENTENÇA" }],
  };
  const resposta = (tarefas: RespostaIa["tarefas"]): RespostaIa => ({ resumo: "", tarefas, esocial: "Não Identificado", confianca: "alta", prazo_de: "cliente" });
  const guardada = (tarefas: SugestaoIa["tarefas"]): SugestaoIa => ({ resumo: "", tarefas, esocial: ESOCIAL_PADRAO, confianca: "media", modelo: "x", geradaEm: "2026-11-09", custoUS: 0 });
  const ro = { classe: "PRAZO" as const, tarefaId: "153", tarefa: "RECURSO ORDINÁRIO", dias: 8, contagem: "uteis" as const, data: null, hora: null, motivo: "Sentença." };

  it("o prompt manda sugerir a SENTENÇA, se a área tiver", () => {
    expect(instrucoesDaSugestao(COM_SENTENCA)).toContain("sugira a tarefa 13 | SENTENÇA, e nunca RECURSO ORDINÁRIO");
    expect(instrucoesDaSugestao(LISTAS)).not.toContain("nunca RECURSO ORDINÁRIO");
  });

  it("na resposta da IA, troca o Recurso Ordinário e tira os dias", () => {
    expect(tarefasDaResposta(resposta([tarefa({ tarefa_id: "153", dias: 8, contagem: "uteis", motivo: "Sentença." })]), COM_SENTENCA)).toEqual([
      { classe: "PRAZO", tarefaId: "13", tarefa: "SENTENÇA", dias: null, contagem: null, data: null, hora: null, motivo: "Sentença." },
    ]);
  });

  it("a SENTENÇA sugerida sem dias fica; com o Recurso junto, sai uma só", () => {
    expect(tarefasDaResposta(resposta([tarefa({ tarefa_id: "13" })]), COM_SENTENCA).map((item) => item.tarefaId)).toEqual(["13"]);
    expect(tarefasDaResposta(resposta([tarefa({ tarefa_id: "13" }), tarefa({ tarefa_id: "153", dias: 8 })]), COM_SENTENCA).map((item) => item.tarefaId)).toEqual(["13"]);
  });

  it("área sem a SENTENÇA na lista: o Recurso Ordinário fica", () => {
    const semSentenca = { ...LISTAS, PRAZO: [{ id: "153", nome: "RECURSO ORDINÁRIO" }] };
    expect(tarefasDaResposta(resposta([tarefa({ tarefa_id: "153", dias: 8, contagem: "uteis" })]), semSentenca)[0]).toMatchObject({ tarefaId: "153", dias: 8 });
    expect(sugestaoNaListaAtual(guardada([ro]), semSentenca).tarefas[0]).toMatchObject({ tarefaId: "153", dias: 8 });
  });

  it("sugestão já guardada: o Recurso Ordinário e a SENTENÇA com dias aparecem como SENTENÇA sem prazo", () => {
    const trocada = sugestaoNaListaAtual(guardada([ro]), COM_SENTENCA);
    expect(trocada.tarefas).toEqual([{ ...ro, tarefaId: "13", tarefa: "SENTENÇA", dias: null, contagem: null }]);
    expect(fatalSugerida(trocada.tarefas[0], "2026-11-10", contaPrazo)).toBeNull();
    expect(sugestaoNaListaAtual(guardada([{ ...ro, tarefaId: "13", tarefa: "SENTENÇA" }]), COM_SENTENCA).tarefas[0]).toMatchObject({ tarefaId: "13", dias: null });
    expect(sugestaoNaListaAtual(guardada([ro, { ...ro, tarefaId: "13", tarefa: "SENTENÇA" }]), COM_SENTENCA).tarefas).toHaveLength(1);
  });

  it("já no formato certo, devolve a mesma sugestão", () => {
    const certa = guardada([{ ...ro, tarefaId: "13", tarefa: "SENTENÇA", dias: null, contagem: null }]);
    expect(sugestaoNaListaAtual(certa, COM_SENTENCA)).toBe(certa);
  });
});

describe("areaComSugestaoIa", () => {
  it("todas as áreas, inclusive Operações Legais; sem lista de tarefas, não", () => {
    expect(areaComSugestaoIa("Trabalhista")).toBe(true);
    expect(areaComSugestaoIa("Cível")).toBe(true);
    expect(areaComSugestaoIa("Cível | Insolvência")).toBe(true);
    expect(areaComSugestaoIa("Operações Legais")).toBe(true);
    expect(areaComSugestaoIa(null)).toBe(false);
  });

  it("Operações Legais: instruções de ex-cliente (VERIFICAR RENÚNCIA), qualquer que seja a área da pasta", () => {
    const comRenuncia = { ...LISTAS, PROVIDENCIA: [...LISTAS.PROVIDENCIA, { id: "700", nome: "VERIFICAR RENÚNCIA" }] };
    const texto = instrucoesDaSugestao(comRenuncia, { area: "Trabalhista", escritorio: "Operações Legais" });
    expect(texto).toContain("SOMENTE a tarefa 700 | VERIFICAR RENÚNCIA");
    expect(texto).toContain("SOMENTE a tarefa 316 | CIÊNCIA NF");
    expect(texto).toContain("Nunca sugira prazo processual");
    expect(texto).not.toContain("CLT");
    expect(texto).not.toContain("452 | COMPROVAR PAGAMENTO");
    expect(ehAreaTrabalhista("Trabalhista", "Operações Legais")).toBe(false);
    expect(ehAreaTrabalhista("Trabalhista", "Trabalhista")).toBe(true);
  });
});

describe("instruções por área", () => {
  const COM_SENTENCA: Record<EtiquetaAgendamento, OpcaoTarefa[]> = { ...LISTAS, PRAZO: [...LISTAS.PRAZO, { id: "13", nome: "SENTENÇA" }] };

  it("fora do Trabalhista: CPC em dias úteis, sem eSocial nem a regra da SENTENÇA", () => {
    const texto = instrucoesDaSugestao(COM_SENTENCA, { area: "Cível" });
    expect(texto).toContain("área Cível");
    expect(texto).toContain("dias úteis (art. 219)");
    expect(texto).toContain('"esocial": sempre "Não Identificado"');
    expect(texto).not.toContain("CLT");
    expect(texto).not.toContain("nunca RECURSO ORDINÁRIO");
    expect(texto).toContain("452 | COMPROVAR PAGAMENTO");
    expect(texto).toContain("SOMENTE a tarefa 316 | CIÊNCIA NF");
  });

  it("Insolvência: prazos da Lei 11.101 em dias corridos", () => {
    expect(instrucoesDaSugestao(LISTAS, { area: "Insolvência" })).toContain("dias corridos (art. 189, § 1º, I)");
    expect(instrucoesDaSugestao(LISTAS, { area: "Cível | Insolvência" })).not.toContain("art. 189");
  });

  it("Trabalhista (ou sem área) continua com as instruções da CLT; o costume entra no fim", () => {
    expect(instrucoesDaSugestao(LISTAS, { area: "Trabalhista" })).toBe(instrucoesDaSugestao(LISTAS));
    expect(instrucoesDaSugestao(LISTAS)).toContain("CLT, art. 775");
    expect(instrucoesDaSugestao(LISTAS, { area: "Cível", historico: "COSTUME DO ESCRITÓRIO NESTA ÁREA\n- x" })).toMatch(/COSTUME DO ESCRITÓRIO NESTA ÁREA\n- x$/);
  });

  it("fora do Trabalhista, a SENTENÇA não perde os dias", () => {
    const resposta: RespostaIa = { resumo: "", tarefas: [tarefa({ tarefa_id: "13", dias: 15, contagem: "uteis" })], esocial: "Não Identificado", confianca: "alta", prazo_de: "cliente" };
    expect(tarefasDaResposta(resposta, COM_SENTENCA, { trabalhista: false })[0]).toMatchObject({ tarefaId: "13", dias: 15 });
    expect(tarefasDaResposta(resposta, COM_SENTENCA)[0]).toMatchObject({ tarefaId: "13", dias: null });
  });
});

describe("costume do escritório (histórico)", () => {
  const linha = (publicacaoId: string, tarefa: string, extra: Partial<TarefaDoHistorico> = {}): TarefaDoHistorico => ({
    publicacaoId,
    tarefa,
    classe: "PRAZO",
    dias: 5,
    contagem: "uteis",
    em: `2026-11-1${publicacaoId.slice(-1)}T12:00:00Z`,
    ...extra,
  });

  it("junta por tarefa, com os dias mais comuns, sem as tarefas automáticas e sem as usadas uma vez só", () => {
    const costumes = costumesDaArea([
      linha("p1", "MANIFESTAÇÃO - FLUXO D1"),
      linha("p2", "MANIFESTAÇÃO - FLUXO D1"),
      linha("p3", "MANIFESTAÇÃO - FLUXO D1", { dias: 10 }),
      linha("p3", "1. CIÊNCIA DOS AGENDAMENTOS", { classe: "PROVIDENCIA", dias: null }),
      linha("p4", "INSERIR E-SOCIAL", { classe: "PROVIDENCIA", dias: null }),
      linha("p5", "APELAÇÃO", { dias: 15 }),
      linha("p6", "CIÊNCIA NF", { classe: "PROVIDENCIA", dias: null, contagem: null }),
      linha("p7", "CIÊNCIA NF", { classe: "PROVIDENCIA", dias: null, contagem: null }),
    ]);
    expect(costumes.map((c) => [c.tarefa, c.usos, c.dias])).toEqual([
      ["MANIFESTAÇÃO - FLUXO D1", 3, 5],
      ["CIÊNCIA NF", 2, null],
    ]);
    // Exemplos: primeiro as publicações com uma tarefa só, depois as mais recentes.
    expect(costumes[0].publicacoes).toEqual(["p3", "p2"]); // a Ciência dos Agendamentos não conta: p3 tem uma tarefa só
  });

  it("o trecho começa no comando da decisão, não no cabeçalho", () => {
    const teor = `PROCESSO:123 ORGÃO:5ª Vara TIPO DE COMUNICAÇÃO:Intimação ${"cabeçalho ".repeat(40)} Intime-se a parte autora para se manifestar sobre o laudo no prazo de 5 dias. ${"assinatura ".repeat(40)}`;
    const trecho = trechoDecisivo(teor);
    expect(trecho).toContain("Intime-se a parte autora para se manifestar sobre o laudo");
    expect(trecho.length).toBeLessThanOrEqual(262);
    expect(trechoDecisivo("curto")).toBe("curto");
  });

  it("monta a seção com os dias e os exemplos; sem costume, nada", () => {
    const secao = secaoDoHistorico(
      [{ tarefa: "MANIFESTAÇÃO - FLUXO D1", classe: "PRAZO", usos: 3, dias: 5, contagem: "corridos", publicacoes: ["p1", "p9"] }],
      new Map([["p1", 'Manifeste-se o "credor" em 5 dias']])
    );
    expect(secao).toContain("- MANIFESTAÇÃO - FLUXO D1 (PRAZO, em geral 5 dias corridos): 3 publicações");
    expect(secao).toContain(`· "Manifeste-se o 'credor' em 5 dias"`);
    expect(secaoDoHistorico([], new Map())).toBeNull();
  });
});

describe("registro da IA", () => {
  const sugestao = {
    tarefas: [
      { classe: "PRAZO" as const, tarefaId: "452", tarefa: "COMPROVAR PAGAMENTO", dias: 15, contagem: "uteis" as const, data: null, hora: null, motivo: "" },
      { classe: "PROVIDENCIA" as const, tarefaId: "316", tarefa: "CIÊNCIA NF", dias: null, contagem: null, data: null, hora: null, motivo: "" },
    ],
  };

  it("compara o que a IA sugeriu com o que o advogado agendou (id ou nome; automáticas fora)", () => {
    expect(
      compararComSugestao(sugestao, [
        { tarefaId: "796", tarefa: "CIÊNCIA NF" },
        { tarefaId: "500", tarefa: "INFORMAR CLIENTE" },
        { tarefaId: "792", tarefa: "INSERIR E-SOCIAL" },
      ])
    ).toEqual({ aceitas: ["CIÊNCIA NF"], rejeitadas: ["COMPROVAR PAGAMENTO"], acrescentadas: ["INFORMAR CLIENTE"] });
  });

  it("guarda o que a IA leu, com o teor cortado no mesmo limite", () => {
    const entrada = entradaDoRegistro({
      data_publicacao: "2026-11-16",
      tribunal: "TJSP",
      djen_orgao: "1ª Vara",
      djen_tipo_comunicacao: "Intimação",
      cliente: "Cliente",
      djen_partes: null,
      teor: "x".repeat(25_000),
    });
    expect(entrada).toMatchObject({ tribunal: "TJSP", orgao: "1ª Vara", partes: [] });
    expect((entrada.teor as string).length).toBe(20_000);
  });

  it("aviso de conferir quando a sugestão é só CIÊNCIA NF", () => {
    expect(sugereSoCiencia({ tarefas: [sugestao.tarefas[1]] })).toBe(true);
    expect(sugereSoCiencia(sugestao)).toBe(false);
    expect(sugereSoCiencia({ tarefas: [] })).toBe(false);
  });
});

describe("instrucoesDaSugestao", () => {
  it("leva a lista de cada classe com id e nome", () => {
    const texto = instrucoesDaSugestao(LISTAS);
    expect(texto).toContain("452 | COMPROVAR PAGAMENTO");
    expect(texto).toContain("202 | AUDIÊNCIA UNA/INICIAL");
  });
});

describe("tarefasDaResposta", () => {
  it("descarta tarefa fora da lista da classe e a INSERIR E-SOCIAL", () => {
    const resposta: RespostaIa = {
      resumo: "",
      esocial: "Homologação de cálculo",
      confianca: "alta", prazo_de: "cliente",
      tarefas: [
        tarefa({ dias: 15, contagem: "uteis" }),
        tarefa({ classe: "PRAZO", tarefa_id: "618", dias: 5 }),
        tarefa({ classe: "PROVIDENCIA", tarefa_id: "792" }),
      ],
    };
    expect(tarefasDaResposta(resposta, LISTAS).map((item) => item.tarefaId)).toEqual(["452"]);
  });

  it("cada classe fica só com os campos que usa", () => {
    const [compromisso, ciencia, contestacao] = tarefasDaResposta(
      {
        resumo: "",
        esocial: "Não Identificado",
        confianca: "alta", prazo_de: "cliente",
        tarefas: [
          tarefa({ classe: "COMPROMISSO", tarefa_id: "202", dias: 3, data: "2026-12-03", hora: "11:10" }),
          tarefa({ classe: "PROVIDENCIA", tarefa_id: "618", data: "2026-11-01", hora: "10:00" }),
          tarefa({ classe: "PRAZO", tarefa_id: "418", data: "2026-12-03", hora: "11:10" }),
        ],
      },
      LISTAS
    );
    expect(compromisso).toMatchObject({ dias: null, data: "2026-12-03", hora: "11:10" });
    expect(ciencia).toMatchObject({ data: null, hora: null });
    expect(contestacao).toMatchObject({ dias: null, contagem: null, data: "2026-12-03", hora: null });
  });

  it("prazo sem dias nem data sai", () => {
    expect(tarefasDaResposta({ resumo: "", esocial: "Não Identificado", confianca: "baixa", prazo_de: "cliente", tarefas: [tarefa({})] }, LISTAS)).toEqual([]);
  });
});

describe("prazo da parte contrária", () => {
  it("vira só CIÊNCIA NF, com o porquê", () => {
    const tarefas = tarefasDaResposta(
      {
        resumo: "",
        esocial: "Não Identificado",
        confianca: "alta",
        prazo_de: "parte_contraria",
        tarefas: [tarefa({ classe: "PRAZO", tarefa_id: "452", dias: 15, contagem: "uteis", motivo: "Prazo de 15 dias é do exequente." }), tarefa({ classe: "PROVIDENCIA", tarefa_id: "618" })],
      },
      LISTAS
    );
    expect(tarefas).toEqual([
      { classe: "PROVIDENCIA", tarefaId: "316", tarefa: "CIÊNCIA NF", dias: null, contagem: null, data: null, hora: null, motivo: "Prazo de 15 dias é do exequente." },
    ]);
  });

  it("prazo comum às partes continua com as tarefas", () => {
    const tarefas = tarefasDaResposta(
      { resumo: "", esocial: "Não Identificado", confianca: "alta", prazo_de: "ambas", tarefas: [tarefa({ dias: 5, contagem: "uteis" })] },
      LISTAS
    );
    expect(tarefas.map((item) => item.tarefaId)).toEqual(["452"]);
  });

  it("as instruções citam a CIÊNCIA NF da lista no roteiro", () => {
    const texto = instrucoesDaSugestao(LISTAS);
    expect(texto).toContain("SOMENTE a tarefa 316 | CIÊNCIA NF");
    expect(texto).toContain('"prazo_de"');
  });
});

describe("sem prazo nem providência", () => {
  it("vira só CIÊNCIA NF, mesmo que a IA escolha outra ciência", () => {
    const tarefas = tarefasDaResposta(
      {
        resumo: "",
        esocial: "Não Identificado",
        confianca: "alta",
        prazo_de: "ninguem",
        tarefas: [tarefa({ classe: "PROVIDENCIA", tarefa_id: "618", motivo: "Só a distribuição do agravo de petição." })],
      },
      LISTAS
    );
    expect(tarefas).toEqual([
      { classe: "PROVIDENCIA", tarefaId: "316", tarefa: "CIÊNCIA NF", dias: null, contagem: null, data: null, hora: null, motivo: "Só a distribuição do agravo de petição." },
    ]);
  });

  it("se a IA trouxe audiência ou sessão, fica o compromisso", () => {
    const tarefas = tarefasDaResposta(
      {
        resumo: "",
        esocial: "Não Identificado",
        confianca: "media",
        prazo_de: "ninguem",
        tarefas: [tarefa({ classe: "COMPROMISSO", tarefa_id: "202", data: "2026-12-03", hora: "11:10" })],
      },
      LISTAS
    );
    expect(tarefas.map((item) => item.tarefaId)).toEqual(["202"]);
  });

  it("as instruções mandam CIÊNCIA NF para 'ninguem' e proíbem a ciência genérica", () => {
    const texto = instrucoesDaSugestao(LISTAS);
    expect(texto).toContain('Se "parte_contraria" ou "ninguem": sugira SOMENTE a tarefa 316 | CIÊNCIA NF');
    expect(texto).toContain("Nunca use ACOMPANHAMENTO PROCESSUAL, CIÊNCIA DA MOVIMENTAÇÃO PROCESSUAL");
  });

  it("a entrada leva o cliente e as partes com o polo, sem os intimados", () => {
    const texto = entradaDaSugestao({
      dataPublicacao: "2026-10-29",
      tribunal: "TRT2",
      orgao: "1ª Vara",
      tipoComunicacao: "Intimação",
      cliente: "Empresa Cliente Ltda",
      partes: [
        { nome: "FULANO", polo: "A" },
        { nome: "EMPRESA CLIENTE LTDA", polo: "P" },
      ],
      teor: "Intime-se o reclamante.",
    });
    expect(texto).toContain("Cliente do escritório: Empresa Cliente Ltda");
    expect(texto).toContain("Partes: FULANO (polo ativo); EMPRESA CLIENTE LTDA (polo passivo)");
    expect(texto).not.toContain("Intimados");
  });
});

describe("esocialDaResposta", () => {
  it("valor fora da lista vira Não Identificado", () => {
    expect(esocialDaResposta("Acordo homologado")).toBe("Acordo homologado");
    expect(esocialDaResposta("Sentença")).toBe("Não Identificado");
  });
});

describe("fatalSugerida", () => {
  it("conta os dias úteis a partir da publicação ou usa a data fixada", () => {
    const [porDias, porData] = tarefasDaResposta(
      {
        resumo: "",
        esocial: "Não Identificado",
        confianca: "alta", prazo_de: "cliente",
        tarefas: [tarefa({ dias: 5, contagem: "uteis" }), tarefa({ tarefa_id: "418", data: "2026-12-03" })],
      },
      LISTAS
    );
    // publicada numa segunda: 5 dias úteis vencem na segunda seguinte
    expect(fatalSugerida(porDias, "2026-11-09", contaPrazo)).toBe("2026-11-16");
    expect(fatalSugerida(porData, "2026-11-09", contaPrazo)).toBe("2026-12-03");
  });
});

describe("resultadoDaSugestao", () => {
  const sugestao: SugestaoIa = {
    resumo: "",
    esocial: "Homologação de cálculo",
    confianca: "alta",
    modelo: "gpt-6-luna",
    geradaEm: "2026-11-09T10:00:00Z",
    custoUS: 0.0003,
    tarefas: tarefasDaResposta({ resumo: "", esocial: "", confianca: "alta", prazo_de: "cliente", tarefas: [tarefa({ dias: 5, contagem: "uteis" })] }, LISTAS),
  };
  const item = (mudanca: Partial<AgendamentoValidado> = {}): AgendamentoValidado => ({
    etiqueta: "PRAZO",
    tarefa: "COMPROVAR PAGAMENTO",
    tarefaId: "452",
    data: "2026-11-11",
    dataFatal: "2026-11-16",
    diasPrazo: 5,
    contagemPrazo: "uteis",
    origemPrazo: null,
    hora: null,
    horaFim: null,
    dataLimite: null,
    responsavel: "Advogada",
    responsavelId: "1",
    revisor: "Auxiliar",
    revisorId: "2",
    observacao: null,
    fluxoDatas: [],
    ...mudanca,
  });
  const base = { sugestao, esocial: "Homologação de cálculo" as const, tarefaEsocialId: "792", dataPublicacao: "2026-11-09", ehDiaDePrazo: contaPrazo };

  it("igual à sugestão (a Inserir E-social da classificação não conta)", () => {
    const esocial = item({ etiqueta: "PROVIDENCIA", tarefa: "INSERIR E-SOCIAL", tarefaId: "792", dataFatal: null, diasPrazo: null, contagemPrazo: null });
    expect(resultadoDaSugestao({ ...base, usou: true, itens: [item(), esocial] })).toBe("usada");
  });

  it("fatal, tarefa a mais ou eSocial diferentes contam como alteração", () => {
    expect(resultadoDaSugestao({ ...base, usou: true, itens: [item({ dataFatal: "2026-11-17" })] })).toBe("usada_com_alteracao");
    expect(resultadoDaSugestao({ ...base, usou: true, itens: [item(), item({ tarefaId: "418" })] })).toBe("usada_com_alteracao");
    expect(resultadoDaSugestao({ ...base, usou: true, esocial: "Não Identificado", itens: [item()] })).toBe("usada_com_alteracao");
  });

  it("sem usar, não_usada", () => {
    expect(resultadoDaSugestao({ ...base, usou: false, itens: [item()] })).toBe("nao_usada");
  });
});

describe("custoDaChamada", () => {
  it("entrada em cache sai a 1/10", () => {
    expect(custoDaChamada({ entrada: 4000, cache: 3000, saida: 300 })).toBeCloseTo(0.00028, 6);
  });
});

describe("sugestaoNaListaAtual (tipo recriado no VIOS)", () => {
  const sugestao = (tarefaId: string, tarefa: string): SugestaoIa => ({
    resumo: "",
    tarefas: [{ classe: "PROVIDENCIA", tarefaId, tarefa, dias: null, contagem: null, data: null, hora: null, motivo: "" }],
    esocial: ESOCIAL_PADRAO,
    confianca: "alta",
    modelo: "teste",
    geradaEm: "2026-11-06T10:00:00Z",
    custoUS: 0,
  });
  const lista = (providencias: { id: string; nome: string; nomeVios?: string }[]) => ({ PRAZO: [], PROVIDENCIA: providencias, COMPROMISSO: [] });

  it("CIÊNCIA NF sugerida com o 316 vira o 796, que está na lista", () => {
    const atual = sugestaoNaListaAtual(sugestao("316", "CIÊNCIA NF"), lista([{ id: "796", nome: "CIÊNCIA NF" }]));
    expect(atual.tarefas[0].tarefaId).toBe("796");
  });

  it("com o número na lista, ou sem um único tipo de mesmo nome, fica como veio", () => {
    const comNumero = sugestao("316", "CIÊNCIA NF");
    expect(sugestaoNaListaAtual(comNumero, lista([{ id: "316", nome: "CIÊNCIA NF" }, { id: "796", nome: "CIÊNCIA NF (tipo 796)", nomeVios: "CIÊNCIA NF" }]))).toBe(comNumero);
    const dois = lista([
      { id: "1", nome: "CIÊNCIA NF (tipo 1)", nomeVios: "CIÊNCIA NF" },
      { id: "2", nome: "CIÊNCIA NF (tipo 2)", nomeVios: "CIÊNCIA NF" },
    ]);
    expect(sugestaoNaListaAtual(comNumero, dois).tarefas[0].tarefaId).toBe("316");
    expect(sugestaoNaListaAtual(comNumero, lista([])).tarefas[0].tarefaId).toBe("316");
  });
});

describe("sugestaoSemOQueOFluxoCria (pedido de 26/11/2026)", () => {
  const doFluxo = (id: string, nome: string): TarefaDoFluxo => ({
    id,
    nome,
    prazo: null,
    papel: "responsavel",
    tambemCria: [],
    aoConcluir: [],
    regra: null,
    responsabilidade: null,
    filhas: [],
  });
  // AUDIÊNCIA UNA/INICIAL (202) no VIOS: cria a CONTESTAÇÃO 418 e a INFORMAR CLIENTE, entre outras.
  const FLUXOS: Record<string, FluxoDaTarefa> = {
    "202": { criacao: [doFluxo("418", "CONTESTAÇÃO"), doFluxo("412", "INFORMAR CLIENTE")], conclusao: [] },
  };
  const fluxoDe = (id: string) => FLUXOS[id] ?? null;
  const sugerida = (classe: EtiquetaAgendamento, tarefaId: string, tarefa: string, data: string | null = null) => ({
    classe,
    tarefaId,
    tarefa,
    dias: null,
    contagem: null,
    data,
    hora: null,
    motivo: "trecho",
  });
  // Como a 0011635-64.2026.5.15.0085 (05/11): a IA sugeriu a CONTESTAÇÃO e a AUDIÊNCIA no mesmo dia.
  const comPar: SugestaoIa = {
    resumo: "Audiência inicial designada.",
    tarefas: [sugerida("PRAZO", "418", "CONTESTAÇÃO", "2027-04-22"), sugerida("COMPROMISSO", "202", "AUDIÊNCIA UNA/INICIAL", "2027-04-22")],
    esocial: ESOCIAL_PADRAO,
    confianca: "alta",
    modelo: "teste",
    geradaEm: "2026-11-05T10:00:00Z",
    custoUS: 0,
  };

  it("tira a CONTESTAÇÃO que o fluxo da AUDIÊNCIA UNA/INICIAL já cria e diz por quê", () => {
    const limpa = sugestaoSemOQueOFluxoCria(comPar, fluxoDe);
    expect(limpa.tarefas.map((tarefa) => tarefa.tarefa)).toEqual(["AUDIÊNCIA UNA/INICIAL"]);
    expect(limpa.tiradasPeloFluxo).toEqual([{ tarefa: "CONTESTAÇÃO", criadaPor: "AUDIÊNCIA UNA/INICIAL" }]);
    expect(comPar.tarefas).toHaveLength(2);
  });

  it("sem par no fluxo, ou já limpa, devolve a mesma sugestão", () => {
    const soAudiencia = { ...comPar, tarefas: [comPar.tarefas[1]] };
    expect(sugestaoSemOQueOFluxoCria(soAudiencia, fluxoDe)).toBe(soAudiencia);
    const limpa = sugestaoSemOQueOFluxoCria(comPar, fluxoDe);
    expect(sugestaoSemOQueOFluxoCria(limpa, fluxoDe)).toBe(limpa);
    expect(sugestaoSemOQueOFluxoCria(comPar, () => null)).toBe(comPar);
  });

  it("a INFORMAR CLIENTE sugerida com a audiência também sai", () => {
    const comInformar = { ...comPar, tarefas: [comPar.tarefas[1], sugerida("PROVIDENCIA", "412", "INFORMAR CLIENTE")] };
    expect(sugestaoSemOQueOFluxoCria(comInformar, fluxoDe).tarefas.map((tarefa) => tarefa.tarefaId)).toEqual(["202"]);
  });
});
