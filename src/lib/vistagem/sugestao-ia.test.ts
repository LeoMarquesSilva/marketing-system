import { describe, expect, it } from "vitest";
import type { AgendamentoValidado, EtiquetaAgendamento, OpcaoTarefa } from "./agendamento";
import { criarCalendarioDePrazo } from "./dias-uteis";
import {
  areaComSugestaoIa,
  custoDaChamada,
  esocialDaResposta,
  fatalSugerida,
  instrucoesDaSugestao,
  resultadoDaSugestao,
  tarefasDaResposta,
  type RespostaIa,
  type SugestaoIa,
} from "./sugestao-ia";

const LISTAS: Record<EtiquetaAgendamento, OpcaoTarefa[]> = {
  PRAZO: [
    { id: "452", nome: "COMPROVAR PAGAMENTO" },
    { id: "418", nome: "CONTESTAÇÃO" },
  ],
  PROVIDENCIA: [
    { id: "618", nome: "CIÊNCIA DA MOVIMENTAÇÃO PROCESSUAL" },
    { id: "792", nome: "INSERIR E-SOCIAL" },
  ],
  COMPROMISSO: [{ id: "202", nome: "AUDIÊNCIA UNA/INICIAL" }],
};

const contaPrazo = criarCalendarioDePrazo([]);

function tarefa(item: Partial<RespostaIa["tarefas"][number]>): RespostaIa["tarefas"][number] {
  return { classe: "PRAZO", tarefa_id: "452", dias: null, contagem: null, data: null, hora: null, motivo: "trecho", ...item };
}

describe("areaComSugestaoIa", () => {
  it("só Trabalhista", () => {
    expect(areaComSugestaoIa("Trabalhista")).toBe(true);
    expect(areaComSugestaoIa("Cível")).toBe(false);
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
      confianca: "alta",
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
        confianca: "alta",
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
    expect(tarefasDaResposta({ resumo: "", esocial: "Não Identificado", confianca: "baixa", tarefas: [tarefa({})] }, LISTAS)).toEqual([]);
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
        confianca: "alta",
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
    tarefas: tarefasDaResposta({ resumo: "", esocial: "", confianca: "alta", tarefas: [tarefa({ dias: 5, contagem: "uteis" })] }, LISTAS),
  };
  const item = (mudanca: Partial<AgendamentoValidado> = {}): AgendamentoValidado => ({
    etiqueta: "PRAZO",
    tarefa: "COMPROVAR PAGAMENTO",
    tarefaId: "452",
    data: "2026-11-11",
    dataFatal: "2026-11-16",
    diasPrazo: 5,
    contagemPrazo: "uteis",
    hora: null,
    responsavel: "Advogada",
    responsavelId: "1",
    revisor: "Auxiliar",
    revisorId: "2",
    observacao: null,
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
