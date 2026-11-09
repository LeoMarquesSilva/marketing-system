import { describe, expect, it } from "vitest";
import {
  areaNoBkp,
  escritorioNoBkp,
  linhaDoBkp,
  entraNoBkp,
  publicacaoParaBkp,
  statusNaLista,
  tiposDoAgendamento,
  vistadoD1,
  type LinhaDaVistagem,
  type PublicacaoParaBkp,
} from "./bkp-sioe";
import { MOTIVO_EX_CLIENTE_SEM_ESCRITORIO, PREFIXO_DESCARTE_CONTROLADORIA } from "./triagem";

const FERIADOS = new Set(["2026-11-02", "2026-11-20"]);

function publicacao(campos: Partial<PublicacaoParaBkp> = {}): PublicacaoParaBkp {
  return {
    status: "checado",
    numeroProcesso: "0012362-52.2025.5.15.0022",
    numeroProcessoOriginal: "00123625220255150022",
    dataPublicacao: "2026-11-05",
    dataDivulgacao: "2026-11-04",
    dataImportacao: "2026-11-04",
    pastaCi: "59597",
    pastaVinculo: "PROCESSO PRINCIPAL",
    cliente: "Pague Menos Comercio de Produtos Alimenticios Ltda",
    grupoCliente: "Grupo Pague Menos",
    advogadoResponsavel: "Pamela Klava Senna Patricio",
    escritorioResponsavel: "Trabalhista",
    situacaoProcesso: "Ativo",
    acaoProcesso: "Reclamação Trabalhista",
    demandaRisco: false,
    publicacaoEsocial: "Sentença – Conhecimento",
    checkNota: null,
    disponibilizadoEm: "2026-11-04T13:31:55Z",
    vistadoPor: "Isadora Godoy Conte",
    vistadoEm: "2026-11-04T15:14:07Z",
    agendadoPor: "Maria Heloiza Gois Ponce",
    registradoEm: "2026-11-05T03:14:55Z",
    ...campos,
  };
}

describe("escritório e área como na lista do SharePoint", () => {
  it("usa as opções da lista e o De-Para do painel", () => {
    expect(escritorioNoBkp("Cível | Insolvência")).toBe("CÍVEL | INSOLVÊNCIA");
    expect(escritorioNoBkp("Distressed Deals")).toBe("SPECIAL SITUATIONS");
    expect(escritorioNoBkp("Recuperação de Crédito")).toBe("RECUPERAÇÃO DE CRÉDITO");
    expect(areaNoBkp("INSOLVÊNCIA")).toBe("Reestruturação");
    expect(areaNoBkp("SPECIAL SITUATIONS")).toBe("Distressd Deals");
    expect(escritorioNoBkp(null)).toBeNull();
  });
});

describe("tiposDoAgendamento", () => {
  it("marca as caixas da lista na ordem dela, sem a Ciência dos Agendamentos", () => {
    expect(
      tiposDoAgendamento([
        { etiqueta: "PROVIDENCIA", tarefa: "INFORMAR CLIENTE" },
        { etiqueta: "PRAZO", tarefa: "RECURSO ORDINÁRIO" },
        { etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS" },
      ])
    ).toEqual(["PRAZO", "PROVIDÊNCIAS"]);
    expect(tiposDoAgendamento([{ etiqueta: "PROVIDENCIA", tarefa: "CIÊNCIA NF" }])).toEqual(["CIÊNCIA NF"]);
    expect(tiposDoAgendamento([{ etiqueta: "COMPROMISSO", tarefa: "SESSÃO DE JULGAMENTO" }])).toEqual(["PRAZO"]);
  });
});

describe("vistadoD1 (regra do sync do SIOE)", () => {
  it("até 12h do próximo dia útil", () => {
    // disponibilizada qua 04/11; limite qui 05/11 12h (15h UTC)
    expect(vistadoD1("2026-11-04T13:31:55Z", "2026-11-04T15:14:07Z", FERIADOS)).toBe("Sim");
    expect(vistadoD1("2026-11-04T13:31:55Z", "2026-11-05T14:59:00Z", FERIADOS)).toBe("Sim");
    expect(vistadoD1("2026-11-04T13:31:55Z", "2026-11-05T15:01:00Z", FERIADOS)).toBe("Não");
  });

  it("pula fim de semana e feriado", () => {
    // sex 30/10: próximo dia útil é ter 03/11 (seg 02/11 é feriado)
    expect(vistadoD1("2026-10-30T13:00:00Z", "2026-11-03T14:00:00Z", FERIADOS)).toBe("Sim");
    expect(vistadoD1("2026-10-30T13:00:00Z", "2026-11-03T16:00:00Z", FERIADOS)).toBe("Não");
    // disponibilizada às 23h de São Paulo (02h UTC do dia seguinte): conta o dia de São Paulo
    expect(vistadoD1("2026-11-05T02:00:00Z", "2026-11-05T14:00:00Z", FERIADOS)).toBe("Sim");
  });

  it("sem vistagem, vazio", () => {
    expect(vistadoD1("2026-11-04T13:31:55Z", null, FERIADOS)).toBeNull();
  });
});

describe("linhaDoBkp", () => {
  it("publicação checada: as mesmas colunas e valores da lista", () => {
    const linha = linhaDoBkp(
      publicacao(),
      [
        { etiqueta: "PRAZO", tarefa: "SENTENÇA" },
        { etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS" },
      ],
      [
        { origem: "juridico", tipo: "CONTAGEM DE PRAZO", subtipo: null, descricao: "Prazo do fluxo não foi conferido.", criadoEm: "2026-11-05T02:22:32Z" },
      ],
      FERIADOS
    );
    expect(linha).toEqual({
      criado: "2026-11-05T03:14:55Z",
      data_publicacao: "2026-11-05",
      data_divulgacao: "2026-11-04",
      data_recebimento_kurier: "2026-11-04",
      numero_processo: "0012362-52.2025.5.15.0022",
      pasta: "PROCESSO PRINCIPAL - CI 59597",
      cliente_principal: "Pague Menos Comercio de Produtos Alimenticios Ltda",
      grupo: "Grupo Pague Menos",
      responsavel_principal: "Pamela Klava Senna Patricio",
      escritorio_responsavel: "TRABALHISTA",
      area: "Trabalhista",
      tipo_agendamento: '["PRAZO"]',
      prioridade_agendamento: "Não",
      agendado_por: "Maria Heloiza Gois Ponce",
      vistado_por: "Isadora Godoy Conte",
      area_vistador: null,
      disponibilizado_vistagem: "2026-11-04T13:31:55Z",
      vistado_em: "2026-11-04T15:14:07Z",
      vistado_d1: "Sim",
      demanda_risco: "Não",
      status_publicacao: "CHECKADO",
      natureza: null,
      status: "Ativo",
      acao: "Reclamação Trabalhista",
      eficiencia: "EFICIÊNCIA DE PUBLICAÇÃO",
      inconsistencias_tipo: null,
      inconsistencia_subtipo: null,
      inconsistencias_juridico: "CONTAGEM DE PRAZO",
      inconsistencia_juridico_descricao: "Prazo do fluxo não foi conferido.",
      check_pub: null,
      publicacao_esocial: "Sentença – Conhecimento",
    });
  });

  it("erro no check vira DESVIO, com o tipo e o subtipo mais recentes", () => {
    const linha = linhaDoBkp(
      publicacao({ checkNota: "Corrigido no VIOS." }),
      [{ etiqueta: "PRAZO", tarefa: "SENTENÇA" }],
      [
        { origem: "agendamento", tipo: "AGENDAMENTO", subtipo: "RESPONSÁVEL - (P/A)", descricao: "a", criadoEm: "2026-11-05T01:00:00Z" },
        { origem: "agendamento", tipo: "AGENDAMENTO", subtipo: "DATA / HORÁRIO - (P/A)", descricao: "b", criadoEm: "2026-11-05T02:00:00Z" },
      ],
      FERIADOS
    );
    expect(linha).toMatchObject({
      eficiencia: "DESVIO",
      inconsistencias_tipo: "AGENDAMENTO",
      inconsistencia_subtipo: "DATA / HORÁRIO - (P/A)",
      check_pub: "Corrigido no VIOS.",
    });
  });

  it("duplicidade confirmada: tipo DUPLICIDADE, sem vistador", () => {
    const duplicidade = linhaDoBkp(publicacao({ status: "duplicidade", agendadoPor: "Maria Heloiza Gois Ponce" }), [], [], FERIADOS);
    expect(duplicidade).toMatchObject({ tipo_agendamento: '["DUPLICIDADE"]', vistado_por: null, vistado_em: null, vistado_d1: null, status_publicacao: "CHECKADO" });
  });

  it("ex-cliente: tratado pela controladoria é RENÚNCIA; descartado na triagem fica sem tipo e sem agendado por", () => {
    const exCliente = { escritorioResponsavel: "Operações Legais", situacaoProcesso: "Encerrado" };
    const tratado = linhaDoBkp(publicacao({ ...exCliente, exCliente: true }), [{ etiqueta: "PROVIDENCIA", tarefa: "RENÚNCIA" }], [], FERIADOS);
    expect(tratado).toMatchObject({ tipo_agendamento: '["RENÚNCIA"]', area: "Operações Legais", agendado_por: "Maria Heloiza Gois Ponce" });
    const descartado = linhaDoBkp(publicacao({ ...exCliente, status: "descartada", agendadoPor: null, vistadoPor: null, vistadoEm: null }), [], [], FERIADOS);
    expect(descartado).toMatchObject({
      tipo_agendamento: null,
      agendado_por: null,
      vistado_por: null,
      area: "Operações Legais",
      escritorio_responsavel: "OPERAÇÕES LEGAIS",
      status_publicacao: "CHECKADO",
      eficiencia: "EFICIÊNCIA DE PUBLICAÇÃO",
    });
  });

  it("demanda de risco e prioridade; outra pasta e área da Reestruturação", () => {
    const linha = linhaDoBkp(
      publicacao({ demandaRisco: true, pastaVinculo: "Recurso", escritorioResponsavel: "Cível | Insolvência" }),
      [{ etiqueta: "PROVIDENCIA", tarefa: "INFORMAR CLIENTE" }],
      [],
      FERIADOS
    );
    expect(linha).toMatchObject({
      demanda_risco: "Sim",
      prioridade_agendamento: "Sim",
      pasta: "RECURSO - CI 59597",
      escritorio_responsavel: "CÍVEL | INSOLVÊNCIA",
      area: "Reestruturação",
      tipo_agendamento: '["PROVIDÊNCIAS"]',
    });
  });
});

function linhaDaVistagem(campos: Partial<LinhaDaVistagem> = {}): LinhaDaVistagem {
  return {
    id: "pub-1",
    status: "checado",
    numero_processo: "0010863-79.2026.5.15.0060",
    processo_sufixo: null,
    numero_processo_original: "00108637920265150060",
    data_publicacao: "2026-11-05",
    data_divulgacao: "2026-11-04",
    pasta_ci: "58393",
    pasta_vinculo: null,
    cliente: "Casp Industria e Comercio Ltda",
    grupo_cliente: "Grupo CASP",
    advogado_responsavel: "Fernanda Voltarelli Arnoni",
    escritorio_responsavel: "Trabalhista",
    situacao_processo: "Ativo",
    acao_processo: "Reclamação Trabalhista",
    demanda_risco: false,
    publicacao_esocial: null,
    check_nota: null,
    motivo_descarte: null,
    pendencia: null,
    duplicidade_de: null,
    triada_em: "2026-11-04T10:43:46Z",
    triagem_resolvida_em: null,
    transferido_em: null,
    vistado_por: "u-isadora",
    vistado_em: "2026-11-04T14:11:08Z",
    conferido_por: "u-maria",
    checado_em: "2026-11-05T02:59:21Z",
    duplicidade_resultado: null,
    duplicidade_revisada_por: null,
    duplicidade_revisada_em: null,
    created_at: "2026-11-04T10:40:00Z",
    arquivo: { data_arquivo: "2026-11-04" },
    ...campos,
  };
}

describe("o que entra no BKP", () => {
  it("sem pasta fica como possível abertura e o nome segue a grafia da lista", () => {
    const linha = linhaDoBkp(publicacao({ pastaCi: null, vistadoPor: "Renato Rossetti Vallim de Castro" }), [], [], FERIADOS);
    expect(linha.pasta).toBe("POSSÍVEL ABERTURA DE PASTA");
    expect(linha.vistado_por).toBe("Renato Rossetti Vallim De Castro");
  });

  it("a coluna Status segue os valores da lista", () => {
    expect(statusNaLista("Encerrado - Ex-Cliente")).toBe("Encerrado");
    expect(statusNaLista("Arquivado definitivamente")).toBe("Encerrado");
    expect(statusNaLista("Ativo")).toBe("Ativo");
    expect(statusNaLista("Suspenso")).toBe("Suspenso");
    expect(statusNaLista(null)).toBeNull();
  });

  it("dos lotes do piloto só a Trabalhista checada; da troca em diante, tudo", () => {
    const piloto = { arquivo: { data_arquivo: "2026-11-06" } };
    const troca = { arquivo: { data_arquivo: "2026-11-09" } };
    expect(entraNoBkp(linhaDaVistagem(piloto))).toBe(true);
    expect(entraNoBkp(linhaDaVistagem({ ...piloto, status: "duplicidade" }))).toBe(false);
    expect(entraNoBkp(linhaDaVistagem({ ...piloto, escritorio_responsavel: "Cível" }))).toBe(false);
    expect(entraNoBkp(linhaDaVistagem({ ...troca, status: "duplicidade" }))).toBe(true);
    expect(entraNoBkp(linhaDaVistagem({ ...troca, escritorio_responsavel: "Cível" }))).toBe(true);
  });
});

describe("publicacaoParaBkp", () => {
  const nomes: Record<string, string> = { "u-isadora": "Isadora Godoy Conte", "u-maria": "Maria Heloiza Gois Ponce" };
  const nome = (id: string | null) => (id ? nomes[id] ?? null : null);

  it("duplicidade leva pasta, cliente e área da original; agendado por quem confirmou", () => {
    const original = linhaDaVistagem();
    const duplicada = linhaDaVistagem({
      id: "pub-2",
      status: "duplicidade",
      duplicidade_de: "pub-1",
      duplicidade_resultado: "confirmada",
      duplicidade_revisada_por: "u-maria",
      duplicidade_revisada_em: "2026-11-04T14:28:14Z",
      pasta_ci: null,
      cliente: null,
      grupo_cliente: null,
      advogado_responsavel: null,
      escritorio_responsavel: null,
      situacao_processo: null,
      acao_processo: null,
      demanda_risco: null,
      triada_em: null,
      vistado_por: null,
      vistado_em: null,
      conferido_por: null,
      checado_em: null,
    });
    const linha = linhaDoBkp(publicacaoParaBkp(duplicada, nome, original)!, [], [], FERIADOS);
    expect(linha).toMatchObject({
      tipo_agendamento: '["DUPLICIDADE"]',
      pasta: "PROCESSO PRINCIPAL - CI 58393",
      cliente_principal: "Casp Industria e Comercio Ltda",
      area: "Trabalhista",
      demanda_risco: "Não",
      agendado_por: "Maria Heloiza Gois Ponce",
      disponibilizado_vistagem: "2026-11-04T10:40:00Z",
      criado: "2026-11-04T14:28:14Z",
    });
    expect(publicacaoParaBkp({ ...duplicada, duplicidade_resultado: null }, nome, original)).toBeNull();
  });

  it("abertura de pasta fecha ao ir para a Central: tipos das tarefas, sem pasta e sem agendado por", () => {
    const abertura = publicacaoParaBkp(
      linhaDaVistagem({ status: "abertura_pasta", pasta_ci: null, pasta_vinculo: null, pendencia: "sem_pasta", conferido_por: null, checado_em: null, vistado_em: "2026-11-09T14:00:00Z" }),
      nome
    );
    expect(abertura).toMatchObject({ status: "abertura_pasta", agendadoPor: null, registradoEm: "2026-11-09T14:00:00Z" });
    expect(linhaDoBkp(abertura!, [{ etiqueta: "PROVIDENCIA", tarefa: "CIÊNCIA NF" }], [], FERIADOS)).toMatchObject({
      pasta: "POSSÍVEL ABERTURA DE PASTA",
      tipo_agendamento: JSON.stringify(["CIÊNCIA NF"]),
      status_publicacao: "CHECKADO",
      agendado_por: null,
    });
  });

  it("o número leva o incidente, como na lista", () => {
    const comSufixo = publicacaoParaBkp(linhaDaVistagem({ numero_processo: "1413501-21.2026.8.12.0000", processo_sufixo: "50002" }), nome);
    expect(linhaDoBkp(comSufixo!, [], [], FERIADOS).numero_processo).toBe("1413501-21.2026.8.12.0000/50002");
  });

  it("ex-cliente: RENÚNCIA só no que ficou em Operações Legais; descartado sem agendado por", () => {
    const tratado = publicacaoParaBkp(linhaDaVistagem({ pendencia: "ex_cliente", escritorio_responsavel: "Operações Legais" }), nome);
    expect(tratado?.exCliente).toBe(true);
    const transferido = publicacaoParaBkp(linhaDaVistagem({ pendencia: "ex_cliente", escritorio_responsavel: "Trabalhista" }), nome);
    expect(transferido?.exCliente).toBe(false);
    const descartado = publicacaoParaBkp(
      linhaDaVistagem({
        status: "descartada",
        motivo_descarte: MOTIVO_EX_CLIENTE_SEM_ESCRITORIO,
        pendencia: "ex_cliente",
        escritorio_responsavel: "Operações Legais",
        vistado_por: null,
        vistado_em: null,
        conferido_por: null,
        checado_em: null,
      }),
      nome
    );
    expect(descartado).toMatchObject({ status: "descartada", exCliente: false, agendadoPor: null, registradoEm: "2026-11-04T10:43:46Z" });
    expect(publicacaoParaBkp(linhaDaVistagem({ status: "descartada", motivo_descarte: "Índice de advogados do diário, não é publicação." }), nome)).toBeNull();
  });

  it("descartada pela controladoria: sem tipo, em Operações Legais quando não tem área", () => {
    const pendencia = publicacaoParaBkp(
      linhaDaVistagem({
        status: "descartada",
        motivo_descarte: `${PREFIXO_DESCARTE_CONTROLADORIA}processo não é do escritório`,
        pendencia: "sem_pasta",
        pasta_ci: null,
        escritorio_responsavel: null,
        triagem_resolvida_em: "2026-11-04T16:00:00Z",
        vistado_por: null,
        vistado_em: null,
        conferido_por: null,
        checado_em: null,
      }),
      nome
    );
    expect(linhaDoBkp(pendencia!, [], [], FERIADOS)).toMatchObject({
      tipo_agendamento: null,
      agendado_por: null,
      pasta: "POSSÍVEL ABERTURA DE PASTA",
      area: "Operações Legais",
      criado: "2026-11-04T16:00:00Z",
      status_publicacao: "CHECKADO",
    });
  });
});
