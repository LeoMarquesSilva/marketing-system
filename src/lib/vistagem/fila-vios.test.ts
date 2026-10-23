import { describe, expect, it } from "vitest";
import { cisDoResultado, linhasParaFila, type AgendamentoParaFila, type PublicacaoParaFila } from "./fila-vios";

const PUBLICACAO: PublicacaoParaFila = {
  data_publicacao: "2026-10-15",
  tribunal: "TRT17",
  numero_processo: "0000952-37.2026.5.17.0141",
  djen_id_comunicacao: 755730632,
  teor: "PROCESSO:0000952 TEXTO: Intimem-se as partes.",
  pasta_ci: "58866",
};

const ITENS: AgendamentoParaFila[] = [
  { id: "ag-1", etiqueta: "PRAZO", tarefa: "MANIFESTAÇÃO - FLUXO D1", tarefa_id: "136", data: "2026-10-16", responsavel: "Maria Heloiza Gois Ponce", revisor: "Giovanna Pereira de Souza", observacao: "laudo" },
  { id: "ag-2", etiqueta: "PROVIDENCIA", tarefa: "ACOMPANHAMENTO PROCESSUAL DIÁRIO", tarefa_id: "731", data: "2026-10-19", responsavel: "Giovanna Pereira de Souza", revisor: null, observacao: null },
];

describe("fila do robô", () => {
  it("na pasta: uma linha por tarefa, com o teor na descrição", () => {
    const linhas = linhasParaFila(PUBLICACAO, ITENS, { simular: false, modo: "pasta" });
    expect(linhas.map((l) => l.agendamentos)).toEqual([["ag-1"], ["ag-2"]]);
    expect(linhas[0].linha.observacao).toContain("TEOR DA PUBLICAÇÃO");
    expect(linhas[0].linha.lancamento).toBeUndefined();
    expect(linhas[1].linha).toMatchObject({ tipo: "Providências", etiqueta_id: "204", data: "19/10/2026" });
  });

  it("compromisso vai com a etiqueta COMPROMISSO do VIOS", () => {
    const audiencia: AgendamentoParaFila = { ...ITENS[1], etiqueta: "COMPROMISSO", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefa_id: "54" };
    expect(linhasParaFila(PUBLICACAO, [audiencia], { simular: false, modo: "pasta" })[0].linha).toMatchObject({ tipo: "Compromisso", etiqueta_id: "205" });
    const [grupo] = linhasParaFila(PUBLICACAO, [ITENS[0], audiencia], { simular: false, modo: "intimacao" });
    expect(grupo.linha.lancamento?.tarefas.map((t) => t.etiqueta_id)).toEqual(["1", "205"]);
  });

  it("na intimação: uma linha com todas as tarefas, ligada pelo ID de comunicação", () => {
    const [grupo, ...resto] = linhasParaFila(PUBLICACAO, ITENS, { simular: true, modo: "intimacao" });
    expect(resto).toHaveLength(0);
    expect(grupo.agendamentos).toEqual(["ag-1", "ag-2"]);
    expect(grupo.linha).toMatchObject({ tarefa: "MANIFESTAÇÃO - FLUXO D1", data: "16/10/2026", pasta: "0000952-37.2026.5.17.0141", simular: true });
    expect(grupo.linha.lancamento).toEqual({
      comunicacao_id: "755730632",
      comunicacoes_equivalentes: [],
      data_publicacao: "15/10/2026",
      tarefas: [
        {
          chave: "ag-1",
          tarefa_id: "136",
          tarefa: "MANIFESTAÇÃO - FLUXO D1",
          etiqueta_id: "1",
          data: "16/10/2026",
          responsavel: "Maria Heloiza Gois Ponce",
          revisor: "Giovanna Pereira de Souza",
          observacao: "Publicação de 15/10/2026 · TRT17 · Processo 0000952-37.2026.5.17.0141 · ID comunicação 755730632\nlaudo\nVistagem pelo Orquestra.",
        },
        {
          chave: "ag-2",
          tarefa_id: "731",
          tarefa: "ACOMPANHAMENTO PROCESSUAL DIÁRIO",
          etiqueta_id: "204",
          data: "19/10/2026",
          responsavel: "Giovanna Pereira de Souza",
          revisor: null,
          observacao: "Publicação de 15/10/2026 · TRT17 · Processo 0000952-37.2026.5.17.0141 · ID comunicação 755730632\nVistagem pelo Orquestra.",
        },
      ],
    });
    // o VIOS insere o texto da intimação: o teor não vai repetido
    expect(grupo.linha.observacao).not.toContain("TEOR");
  });

  it("leva os IDs das duplicadas da mesma publicação, sem repetir o próprio", () => {
    const [grupo] = linhasParaFila({ ...PUBLICACAO, comunicacoes_equivalentes: [755730688, "755730632", "755730688"] }, ITENS.slice(0, 1), {
      simular: false,
      modo: "intimacao",
    });
    expect(grupo.linha.lancamento?.comunicacoes_equivalentes).toEqual(["755730688"]);
  });

  it("sem ID de comunicação vai a data de publicação para o robô escolher", () => {
    const [grupo] = linhasParaFila({ ...PUBLICACAO, djen_id_comunicacao: null }, ITENS.slice(0, 1), { simular: false, modo: "intimacao" });
    expect(grupo.linha.lancamento).toMatchObject({ comunicacao_id: null, data_publicacao: "15/10/2026" });
  });

  it("lê o CI de cada tarefa lançada", () => {
    const cis = cisDoResultado({ ci_vios: 900, tarefas: [{ chave: "ag-1", ci_vios: 900 }, { chave: "ag-2", ci_vios: null }] });
    expect([...cis.entries()]).toEqual([["ag-1", "900"]]);
    expect(cisDoResultado({ ci_vios: 900 }).size).toBe(0);
    expect(cisDoResultado(null).size).toBe(0);
  });
});
