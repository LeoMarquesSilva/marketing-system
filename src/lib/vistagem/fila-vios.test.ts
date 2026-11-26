import { describe, expect, it } from "vitest";
import {
  cisDoResultado,
  ehCienciaNf,
  linhaDeQuemVistou,
  linhasParaFila,
  modoDaPublicacao,
  podeTerGravadoNoVios,
  responsavelQueOViosPos,
  tarefasViosDoResultado,
  type AgendamentoParaFila,
  type PublicacaoParaFila,
} from "./fila-vios";

const PUBLICACAO: PublicacaoParaFila = {
  data_publicacao: "2026-10-15",
  tribunal: "TRT17",
  numero_processo: "0000952-37.2026.5.17.0141",
  djen_id_comunicacao: 755730632,
  teor: "PROCESSO:0000952 TEXTO: Intimem-se as partes.",
  pasta_ci: "58866",
};

/** Sem o CI da pasta, a publicação colada ainda vai pela linha antiga (uma por tarefa). */
const SEM_CI: PublicacaoParaFila = { ...PUBLICACAO, pasta_ci: null };

const ITENS: AgendamentoParaFila[] = [
  { id: "ag-1", etiqueta: "PRAZO", tarefa: "MANIFESTAÇÃO - FLUXO D1", tarefa_id: "136", data: "2026-10-16", hora: null, responsavel: "Maria Heloiza Gois Ponce", revisor: "Giovanna Pereira de Souza", observacao: "laudo" },
  { id: "ag-2", etiqueta: "PROVIDENCIA", tarefa: "ACOMPANHAMENTO PROCESSUAL DIÁRIO", tarefa_id: "731", data: "2026-10-19", hora: null, responsavel: "Giovanna Pereira de Souza", revisor: null, observacao: null },
];

describe("fila do robô", () => {
  it("na pasta sem o CI: uma linha por tarefa, com a data da publicação na descrição e sem o teor", () => {
    const linhas = linhasParaFila(SEM_CI, ITENS, { simular: false, modo: "pasta" });
    expect(linhas.map((l) => l.agendamentos)).toEqual([["ag-1"], ["ag-2"]]);
    expect(linhas[0].linha.observacao).toBe("Publicação de 15/10/2026\nlaudo");
    expect(linhas[1].linha.observacao).toBe("Publicação de 15/10/2026");
    expect(linhas[0].linha.lancamento).toBeUndefined();
    expect(linhas[1].linha).toMatchObject({ tipo: "Providências", etiqueta_id: "204", data: "19/10/2026" });
  });

  it("compromisso vai com a etiqueta COMPROMISSO do VIOS e o horário", () => {
    const audiencia: AgendamentoParaFila = { ...ITENS[1], etiqueta: "COMPROMISSO", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefa_id: "54", hora: "14:30", hora_fim: "15:30" };
    const [naPasta] = linhasParaFila(SEM_CI, [audiencia], { simular: false, modo: "pasta" });
    expect(naPasta.linha).toMatchObject({ tipo: "Compromisso", etiqueta_id: "205" });
    // a fila da pasta não tem coluna de hora: vai na descrição
    expect(naPasta.linha.observacao).toBe("Publicação de 15/10/2026\nHorário: 14:30 às 15:30");
    const [grupo] = linhasParaFila(PUBLICACAO, [ITENS[0], audiencia], { simular: false, modo: "intimacao" });
    expect(grupo.linha.lancamento?.tarefas.map((t) => [t.etiqueta_id, t.hora, t.hora_fim])).toEqual([
      ["1", null, null],
      ["205", "14:30", "15:30"],
    ]);
  });

  it("SESSÃO DE JULGAMENTO: a data limite vai ao robô só quando difere da data", () => {
    const sessao: AgendamentoParaFila = { ...ITENS[1], etiqueta: "COMPROMISSO", tarefa: "SESSÃO DE JULGAMENTO", tarefa_id: "406", data: "2026-11-19", hora: "09:00", hora_fim: "18:00", data_limite: "2026-11-25" };
    const igual: AgendamentoParaFila = { ...sessao, id: "ag-3", data_limite: "2026-11-19" };
    const [grupo] = linhasParaFila(PUBLICACAO, [sessao, igual], { simular: false, modo: "intimacao" });
    expect(grupo.linha.lancamento?.tarefas.map((t) => [t.data, t.data_limite])).toEqual([
      ["19/11/2026", "25/11/2026"],
      ["19/11/2026", null],
    ]);
    // Na pasta o robô põe a data limite igual à data: a outra vai escrita na descrição.
    const [naPasta] = linhasParaFila(SEM_CI, [sessao], { simular: false, modo: "pasta" });
    expect(naPasta.linha.observacao).toBe("Publicação de 15/10/2026\nHorário: 09:00 às 18:00\nData limite: 25/11/2026");
  });

  it("revisor na tarefa: na Sessão de Julgamento e nas audiências do Trabalhista, com revisor escolhido", () => {
    const audiencia: AgendamentoParaFila = {
      ...ITENS[1],
      id: "ag-a",
      etiqueta: "COMPROMISSO",
      tarefa: "AUDIÊNCIA UNA/INICIAL",
      tarefa_id: "202",
      hora: "09:30",
      responsavel: "Pamela Klava Senna Patricio",
      revisor: "Lorena Lourenço Miranda",
    };
    const sessao: AgendamentoParaFila = { ...audiencia, id: "ag-s", tarefa: "SESSÃO DE JULGAMENTO", tarefa_id: "406" };
    const semRevisor: AgendamentoParaFila = { ...audiencia, id: "ag-r", revisor: null };
    const marcas = (publicacao: typeof PUBLICACAO) =>
      linhasParaFila(publicacao, [audiencia, sessao, semRevisor, ITENS[0]], { simular: false, modo: "intimacao" })[0].linha.lancamento?.tarefas.map(
        (t) => [t.tarefa, t.revisor_na_tarefa]
      );
    expect(marcas({ ...PUBLICACAO, escritorio_responsavel: "Trabalhista" })).toEqual([
      ["AUDIÊNCIA UNA/INICIAL", true],
      ["SESSÃO DE JULGAMENTO", true],
      ["AUDIÊNCIA UNA/INICIAL", false],
      ["MANIFESTAÇÃO - FLUXO D1", false],
    ]);
    expect(marcas({ ...PUBLICACAO, escritorio_responsavel: "Cível" })).toEqual([
      ["AUDIÊNCIA UNA/INICIAL", false],
      ["SESSÃO DE JULGAMENTO", true],
      ["AUDIÊNCIA UNA/INICIAL", false],
      ["MANIFESTAÇÃO - FLUXO D1", false],
    ]);
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
      // só para o plano B do robô (agendar na pasta se a publicação não chegar ao VIOS)
      texto_publicacao: "PROCESSO:0000952 TEXTO: Intimem-se as partes.",
      tarefas: [
        {
          chave: "ag-1",
          tarefa_id: "136",
          tarefa: "MANIFESTAÇÃO - FLUXO D1",
          etiqueta_id: "1",
          data: "16/10/2026",
          hora: null,
          hora_fim: null,
          data_limite: null,
          responsavel: "Maria Heloiza Gois Ponce",
          revisor: "Giovanna Pereira de Souza",
          revisor_na_tarefa: false,
          observacao: "Publicação de 15/10/2026\nlaudo",
          justificativa: null,
          fluxo_datas: [],
        },
        {
          chave: "ag-2",
          tarefa_id: "731",
          tarefa: "ACOMPANHAMENTO PROCESSUAL DIÁRIO",
          etiqueta_id: "204",
          data: "19/10/2026",
          hora: null,
          hora_fim: null,
          data_limite: null,
          responsavel: "Giovanna Pereira de Souza",
          revisor: null,
          revisor_na_tarefa: false,
          observacao: "Publicação de 15/10/2026",
          justificativa: null,
          fluxo_datas: [],
        },
      ],
    });
    // o VIOS insere o texto da intimação: o teor não vai repetido
    expect(grupo.linha.observacao).not.toContain("TEOR");
  });

  it("CIÊNCIA NF: a observação vai na justificativa e a descrição fica só com o texto da intimação", () => {
    const ciencia: AgendamentoParaFila = {
      ...ITENS[1],
      tarefa: "CIÊNCIA NF",
      tarefa_id: "316",
      observacao: " Prazo do reclamante: indicar em 10 dias meio ainda não analisado. ",
    };
    const [grupo] = linhasParaFila(PUBLICACAO, [ITENS[0], ciencia], { simular: false, modo: "intimacao" });
    expect(grupo.linha.lancamento?.tarefas.map((t) => [t.tarefa, t.observacao, t.justificativa])).toEqual([
      ["MANIFESTAÇÃO - FLUXO D1", "Publicação de 15/10/2026\nlaudo", null],
      ["CIÊNCIA NF", "", "Prazo do reclamante: indicar em 10 dias meio ainda não analisado."],
    ]);
    const [semObservacao] = linhasParaFila(PUBLICACAO, [{ ...ciencia, observacao: null }], { simular: false, modo: "intimacao" });
    expect(semObservacao.linha.lancamento?.tarefas[0]).toMatchObject({ observacao: "", justificativa: null });
  });

  it("colada à mão (pasta, com o CI): a linha do lançamento, marcada para agendar direto na pasta", () => {
    const [grupo, ...resto] = linhasParaFila(PUBLICACAO, ITENS, { simular: false, modo: "pasta" });
    expect(resto).toHaveLength(0);
    expect(grupo.agendamentos).toEqual(["ag-1", "ag-2"]);
    expect(grupo.linha).toMatchObject({ ci_pasta: "58866", pasta: "0000952-37.2026.5.17.0141" });
    expect(grupo.linha.lancamento).toMatchObject({
      agendar_na_pasta: true,
      publicacao_colada: true,
      // O robô põe o texto na descrição de cada tarefa (descricaoNaPasta).
      texto_publicacao: "PROCESSO:0000952 TEXTO: Intimem-se as partes.",
    });
    // Na intimação não vai a marca: o robô procura a intimação primeiro.
    expect(linhasParaFila(PUBLICACAO, ITENS, { simular: false, modo: "intimacao" })[0].linha.lancamento).not.toHaveProperty("agendar_na_pasta");
  });

  it("pasta de atendimento informada na Triagem Manual: direto na pasta, com o tipo, sem marcar como colada (18/11/2026)", () => {
    const [grupo, ...resto] = linhasParaFila(PUBLICACAO, ITENS, { simular: false, modo: "intimacao", tipoPasta: "Atendimento" });
    expect(resto).toHaveLength(0);
    expect(grupo.linha).toMatchObject({ ci_pasta: "58866", pasta_tipo: "Atendimento" });
    expect(grupo.linha.lancamento).toMatchObject({ agendar_na_pasta: true, pasta_informada: { tipo: "Atendimento" } });
    expect(grupo.linha.lancamento).not.toHaveProperty("publicacao_colada");
    // Nenhuma base conhece a CI: vale como atendimento (o robô abre a tela que existir).
    const [desconhecida] = linhasParaFila(PUBLICACAO, ITENS, { simular: false, modo: "intimacao", tipoPasta: "Desconhecido" });
    expect(desconhecida.linha).toMatchObject({ pasta_tipo: "Atendimento" });
    expect(desconhecida.linha.lancamento).toMatchObject({ agendar_na_pasta: true, pasta_informada: { tipo: "Desconhecido" } });
    // Processo (do SIOE ou aberto hoje): continua pela intimação, como antes.
    const [processo] = linhasParaFila(PUBLICACAO, ITENS, { simular: false, modo: "intimacao", tipoPasta: "Processo" });
    expect(processo.linha).toMatchObject({ pasta_tipo: "Processo" });
    expect(processo.linha.lancamento).not.toHaveProperty("agendar_na_pasta");
    expect(processo.linha.lancamento).not.toHaveProperty("pasta_informada");
    // Colada e de atendimento: as duas marcas.
    const [colada] = linhasParaFila(PUBLICACAO, ITENS, { simular: false, modo: "pasta", tipoPasta: "Atendimento" });
    expect(colada.linha.lancamento).toMatchObject({ agendar_na_pasta: true, publicacao_colada: true, pasta_informada: { tipo: "Atendimento" } });
  });

  it("colada à mão: na CIÊNCIA NF a observação vai na JUSTIFICATIVA NF, não na descrição (0100488-57, 11/11/2026)", () => {
    const ciencia: AgendamentoParaFila = { ...ITENS[1], tarefa: "CIÊNCIA NF", tarefa_id: "316", observacao: "Intimação da reclamada por edital, que não é cliente." };
    const [grupo] = linhasParaFila(PUBLICACAO, [ciencia], { simular: false, modo: "pasta" });
    expect(grupo.linha.lancamento?.tarefas[0]).toMatchObject({
      tarefa: "CIÊNCIA NF",
      observacao: "",
      justificativa: "Intimação da reclamada por edital, que não é cliente.",
    });
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

  it("agrupa as tarefas do VIOS pelo agendamento, a pedida primeiro e o fluxo pela data", () => {
    const mapa = tarefasViosDoResultado({
      tarefas_vios: [
        { ci: 902, chave: "ag-1", principal: false, tipo: "3. PROTOCOLAR", data: "19/10/2026", data_limite: "19/10/2026", hora: null, responsaveis: "Maria, Samuel" },
        { ci: 900, chave: "ag-1", principal: true, tipo: "MANIFESTAÇÃO", data: "16/10/2026", data_limite: "16/10/2026", hora: null, responsaveis: "Maria" },
        { ci: 901, chave: "ag-1", principal: false, tipo: "2. REVISAR", data: "17/10/2026", data_limite: null, hora: "", responsaveis: "Giovanna" },
        { ci: 950, chave: "ag-2", principal: true, tipo: "AUDIÊNCIA", data: "10/11/2026", hora: "14:30", responsaveis: "Ana" },
        { ci: 999, chave: null, principal: false, tipo: "SOLTA", data: "01/11/2026" },
      ],
    });
    expect(mapa.get("ag-1")?.map((t) => [t.ci, t.data])).toEqual([
      ["900", "2026-10-16"],
      ["901", "2026-10-17"],
      ["902", "2026-10-19"],
    ]);
    expect(mapa.get("ag-1")?.[1]).toMatchObject({ hora: null, dataLimite: null, responsaveis: "Giovanna" });
    expect(mapa.get("ag-2")?.[0]).toMatchObject({ principal: true, hora: "14:30", data: "2026-11-10" });
    expect(mapa.size).toBe(2);
    expect(tarefasViosDoResultado({ tarefas: [] }).size).toBe(0);
  });
});

describe("datas do fluxo na fila do robô", () => {
  it("vão em DD/MM/AAAA, com o caminho de tipos de cada tarefa do fluxo", () => {
    const [grupo] = linhasParaFila(
      PUBLICACAO,
      [{ ...ITENS[0], fluxoDatas: [{ caminho: ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"], data: "2026-11-10" }] }],
      { simular: false, modo: "intimacao" }
    );
    expect(grupo.linha.lancamento?.tarefas[0].fluxo_datas).toEqual([{ caminho: ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"], data: "10/11/2026" }]);
    // Só o responsável escolhido: vai sem data (o robô não reagenda), com os nomes.
    const [soPessoa] = linhasParaFila(
      PUBLICACAO,
      [{ ...ITENS[0], fluxoDatas: [{ caminho: ["2. REVISAR"], responsaveis: ["Vanessa Lanza Sellani"] }] }],
      { simular: false, modo: "intimacao" }
    );
    expect(soPessoa.linha.lancamento?.tarefas[0].fluxo_datas).toEqual([{ caminho: ["2. REVISAR"], responsaveis: ["Vanessa Lanza Sellani"] }]);
  });
});

describe("onde agendar cada publicação", () => {
  it("a colada à mão (e-mail, Teams) vai na pasta: não está nas Intimações do VIOS (0101059-16)", () => {
    expect(modoDaPublicacao({ origem: "colado" }, "intimacao")).toBe("pasta");
    expect(modoDaPublicacao([{ origem: "colado" }], "intimacao")).toBe("pasta");
  });

  it("as da Kurier seguem o modo do servidor", () => {
    expect(modoDaPublicacao({ origem: "sharepoint" }, "intimacao")).toBe("intimacao");
    expect(modoDaPublicacao({ origem: "upload" }, "intimacao")).toBe("intimacao");
    expect(modoDaPublicacao(null, "intimacao")).toBe("intimacao");
    expect(modoDaPublicacao({ origem: "sharepoint" }, "pasta")).toBe("pasta");
  });
});

describe("Rodar novamente: erro em que o robô pode já ter gravado no VIOS", () => {
  it("pede confirmação no aviso do robô depois de gravar", () => {
    expect(podeTerGravadoNoVios("ATENÇÃO: o lançamento já tinha sido enviado — confira no VIOS (processo CI 55658) antes de reenviar.")).toBe(true);
  });

  it("pede confirmação quando a fila do SAMA desistiu do caso no meio (0922156-75, 10/11/2026)", () => {
    expect(
      podeTerGravadoNoVios("Execução interrompida (RPA reiniciou ou travou). Conferir manualmente no VIOS antes de reenviar.")
    ).toBe(true);
  });

  it("não pede quando o robô nem começou ou falhou antes de gravar", () => {
    expect(podeTerGravadoNoVios("Excedeu 3 tentativas de envio ao RPA.")).toBe(false);
    expect(podeTerGravadoNoVios("Tipo de tarefa não encontrado no VIOS.")).toBe(false);
    expect(podeTerGravadoNoVios(null)).toBe(false);
    expect(podeTerGravadoNoVios("")).toBe(false);
  });
});

describe("responsavelQueOViosPos: para quem o VIOS agendou a Renúncia pedida sem ninguém (pedido de 18/11/2026)", () => {
  // 0000431-64: pedida sem responsável; o VIOS pôs a Marina (CI 944762).
  const noVios = [
    { ci: "944762", tipo: "VERIFICAR RENÚNCIA", principal: true, data: "2026-11-23", dataLimite: "2026-11-23", hora: null, responsaveis: "Marina Silva Pinelli" },
  ];

  it("pedida sem ninguém: quem o VIOS pôs na tarefa principal", () => {
    expect(responsavelQueOViosPos("", noVios)).toBe("Marina Silva Pinelli");
    expect(responsavelQueOViosPos(null, noVios)).toBe("Marina Silva Pinelli");
  });

  it("pedida para alguém, ou sem o retorno do robô: não muda", () => {
    expect(responsavelQueOViosPos("Natalia Borges Breve", noVios)).toBeNull();
    expect(responsavelQueOViosPos("", null)).toBeNull();
    expect(responsavelQueOViosPos("", [{ ...noVios[0], responsaveis: null }])).toBeNull();
    expect(responsavelQueOViosPos("", [{ ...noVios[0], principal: false }])).toBeNull();
  });
});

describe("CIÊNCIA NF com quem vistou (pedido de 24/11/2026)", () => {
  const ciencia: AgendamentoParaFila = { ...ITENS[1], id: "ag-nf", tarefa: "CIÊNCIA NF", tarefa_id: "796", observacao: "Prazo da parte contrária." };
  const comQuemVistou = { ...PUBLICACAO, vistada_por: "  Isadora   Exemplo " };

  it("intimação: a descrição leva quem vistou (o VIOS junta o texto da intimação embaixo); a observação segue na justificativa", () => {
    const [grupo] = linhasParaFila(comQuemVistou, [ITENS[0], ciencia], { simular: false, modo: "intimacao" });
    expect(grupo.linha.lancamento?.tarefas.map((t) => [t.tarefa, t.observacao, t.justificativa])).toEqual([
      ["MANIFESTAÇÃO - FLUXO D1", "Publicação de 15/10/2026\nlaudo", null],
      ["CIÊNCIA NF", "Vistada por: Isadora Exemplo", "Prazo da parte contrária."],
    ]);
  });

  it("direto na pasta: o cabeçalho da publicação vai junto, porque o robô usa a descrição no lugar dele", () => {
    const [grupo] = linhasParaFila(comQuemVistou, [ciencia], { simular: false, modo: "pasta" });
    expect(grupo.linha.lancamento?.tarefas[0]).toMatchObject({
      observacao: "Publicação de 15/10/2026\nVistada por: Isadora Exemplo",
      justificativa: "Prazo da parte contrária.",
    });
    // A linha antiga (sem o CI da pasta) leva tudo na descrição.
    const [antiga] = linhasParaFila({ ...comQuemVistou, pasta_ci: null }, [ciencia], { simular: false, modo: "pasta" });
    expect(antiga.linha.observacao).toBe("Publicação de 15/10/2026\nVistada por: Isadora Exemplo\nPrazo da parte contrária.");
  });

  it("sem o nome, fica como antes: a descrição só com o texto da intimação", () => {
    for (const publicacao of [PUBLICACAO, { ...PUBLICACAO, vistada_por: "  " }]) {
      const [grupo] = linhasParaFila(publicacao, [ciencia], { simular: false, modo: "intimacao" });
      expect(grupo.linha.lancamento?.tarefas[0].observacao).toBe("");
    }
    const [naPasta] = linhasParaFila(PUBLICACAO, [ciencia], { simular: false, modo: "pasta" });
    expect(naPasta.linha.lancamento?.tarefas[0].observacao).toBe("");
  });

  it("as outras tarefas não levam quem vistou", () => {
    const [grupo] = linhasParaFila(comQuemVistou, ITENS, { simular: false, modo: "intimacao" });
    expect(grupo.linha.lancamento?.tarefas.map((t) => t.observacao).join("\n")).not.toContain("Vistada por");
  });

  it("linhaDeQuemVistou e ehCienciaNf", () => {
    expect(linhaDeQuemVistou(null)).toBeNull();
    expect(linhaDeQuemVistou("Maria")).toBe("Vistada por: Maria");
    expect(ehCienciaNf("Ciência NF")).toBe(true);
    expect(ehCienciaNf("1. CIÊNCIA DOS AGENDAMENTOS")).toBe(false);
  });
});
