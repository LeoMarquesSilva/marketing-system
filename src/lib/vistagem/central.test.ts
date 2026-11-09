import { describe, expect, it } from "vitest";
import { camposDaCentral, dataEnviarNaCentral, linkDoItemNaCentral, motivoDaCentral, processoNaCentral, vaiParaCentral, type PublicacaoParaCentral, type TarefaParaCentral } from "./central";

const publicacao: PublicacaoParaCentral = {
  numero_processo: "1000000-00.2026.5.02.0001",
  processo_sufixo: null,
  numero_processo_original: "10000000020265020001",
  grupo_cliente: "Grupo Teste",
  cliente: null,
  escritorio_responsavel: "Trabalhista",
  demanda_risco: false,
  teor: "PROCESSO:1000000-00.2026.5.02.0001 ORGÃO:1ª Vara TEXTO:Fica intimado.",
  observacao_vistagem: null,
  publicacao_esocial: null,
  sugestao_triagem: null,
};

const prazo: TarefaParaCentral = {
  etiqueta: "PRAZO",
  tarefa: "CONTESTAÇÃO",
  data: "2026-11-20",
  data_fatal: "2026-11-25",
  dias_prazo: 15,
  contagem_prazo: "uteis",
  hora: null,
  hora_fim: null,
  responsavel: "Ana Souza",
  revisor: "Bruno Lima",
  observacao: "Conferir o endereço",
  fluxo_datas: null,
};

const ciencia: TarefaParaCentral = { ...prazo, etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", data: "2026-11-09", data_fatal: null, dias_prazo: null, contagem_prazo: null, revisor: null, observacao: null };

const contexto = { vistadoPor: "Ana Souza", hoje: "2026-11-09", agora: "2026-11-09T14:00:00.000Z" };

describe("vaiParaCentral", () => {
  it("sem pasta vai; com pasta, não", () => {
    expect(vaiParaCentral({ pastaCi: null, pendencia: "sem_pasta" })).toBe(true);
    expect(vaiParaCentral({ pastaCi: "123", pendencia: null })).toBe(false);
  });

  it("com várias pastas não é abertura, mesmo sem uma escolhida", () => {
    expect(vaiParaCentral({ pastaCi: null, pendencia: "varias_pastas" })).toBe(false);
  });
});

describe("camposDaCentral", () => {
  it("usa os campos e valores do fluxo antigo da lista de trabalho", () => {
    const campos = camposDaCentral(publicacao, [prazo], contexto);
    expect(campos).toMatchObject({
      PROCESSO: "1000000-00.2026.5.02.0001",
      DESCRI_x00c7__x00c3_ODOPRAZO: "ABERTURA DE PASTA - PUBLICAÇÃO - GRUPO: Grupo Teste",
      DATA_x002d_ENVIAR: "2026-11-20T03:00:00Z",
      Status: "Pendente",
      _x00c1_REA_x0020__x002f__x0020_E: "TRABALHISTA",
      Tipo_x0020_de_x0020_Agendamento_: "Abertura de Pasta Com Agendamentos",
      DEMANDADERISCO: false,
      DATAATUAL: "2026-11-09T14:00:00.000Z",
    });
    expect(campos).not.toHaveProperty("DEPARTAMENTO");
  });

  it("Operações Legais não existe em ÁREA / EQUIPE: vai em DEPARTAMENTO", () => {
    const campos = camposDaCentral({ ...publicacao, escritorio_responsavel: "Operações Legais" }, [prazo], contexto);
    expect(campos.DEPARTAMENTO).toBe("OPERAÇÕES LEGAIS");
    expect(campos).not.toHaveProperty("_x00c1_REA_x0020__x002f__x0020_E");
  });

  it("Distressed Deals vai como SPECIAL SITUATIONS, a opção da lista", () => {
    expect(camposDaCentral({ ...publicacao, escritorio_responsavel: "Distressed Deals" }, [prazo], contexto)._x00c1_REA_x0020__x002f__x0020_E).toBe("SPECIAL SITUATIONS");
  });

  it("marca a demanda de risco e, sem grupo, usa o cliente", () => {
    const campos = camposDaCentral({ ...publicacao, demanda_risco: true, grupo_cliente: null, cliente: "Empresa X" }, [prazo], contexto);
    expect(campos.DEMANDADERISCO).toBe(true);
    expect(campos.DESCRI_x00c7__x00c3_ODOPRAZO).toBe("ABERTURA DE PASTA - PUBLICAÇÃO - GRUPO: Empresa X");
  });
});

describe("dataEnviarNaCentral", () => {
  it("é a primeira tarefa pedida; a Ciência dos Agendamentos automática não conta", () => {
    expect(dataEnviarNaCentral([ciencia, prazo], "2026-11-09")).toBe("2026-11-20");
  });

  it("só com a Ciência dos Agendamentos, usa a data dela", () => {
    expect(dataEnviarNaCentral([{ ...ciencia, data: "2026-11-12" }], "2026-11-09")).toBe("2026-11-12");
  });

  it("nunca fica no passado", () => {
    expect(dataEnviarNaCentral([{ ...prazo, data: "2026-11-02" }], "2026-11-09")).toBe("2026-11-09");
  });
});

describe("motivoDaCentral", () => {
  it("traz quem pediu, os tipos, as tarefas e a publicação, sem o lixo do fluxo antigo", () => {
    const motivo = motivoDaCentral(publicacao, [prazo, ciencia], "Ana Souza");
    expect(motivo).toContain("SOLICITADO/ENVIADO POR: Ana Souza");
    expect(motivo).toContain("TIPO DA PUBLICAÇÃO: PRAZO\n");
    expect(motivo).toContain("VISTAGEM: ANA SOUZA");
    expect(motivo).toContain("1. PRAZO - CONTESTAÇÃO | Enviar: 20/11/2026 | Fatal: 25/11/2026 (15 dias úteis) | Responsável: Ana Souza | Revisor: Bruno Lima");
    expect(motivo).toContain("   Observação: Conferir o endereço");
    expect(motivo).toContain("2. PROVIDÊNCIA - 1. CIÊNCIA DOS AGENDAMENTOS | Data: 09/11/2026 | Responsável: Ana Souza");
    expect(motivo).toContain(`PUBLICAÇÃO:\n\n${publicacao.teor}`);
    expect(motivo).not.toContain("Value");
  });

  it("Ciência NF leva o ExecutanteNF", () => {
    const nf = { ...ciencia, tarefa: "CIÊNCIA NF", responsavel: "Carla Dias", observacao: "Sem providência" };
    const motivo = motivoDaCentral(publicacao, [nf], "Ana Souza");
    expect(motivo).toContain("TIPO DA PUBLICAÇÃO: CIÊNCIA NF");
    expect(motivo).toContain("ExecutanteNF: Carla Dias");
  });

  it("Compromisso mostra o horário", () => {
    const audiencia = { ...ciencia, etiqueta: "COMPROMISSO" as const, tarefa: "AUDIÊNCIA UNA", data: "2026-12-01", hora: "14:00", hora_fim: "15:00" };
    expect(motivoDaCentral(publicacao, [audiencia], "Ana Souza")).toContain("1. COMPROMISSO - AUDIÊNCIA UNA | Data: 01/12/2026 às 14:00 até 15:00 | Responsável: Ana Souza");
  });

  it("repete as datas e os responsáveis do fluxo que o jurídico trocou", () => {
    const motivo = motivoDaCentral(publicacao, [{ ...prazo, fluxo_datas: [{ caminho: ["CONTESTAÇÃO", "2. REVISAR"], data: "2026-11-21", responsaveis: ["Bruno Lima"] }] }], "Ana Souza");
    expect(motivo).toContain("   Fluxo, 2. REVISAR: 21/11/2026 | Bruno Lima");
  });

  it("mostra o cliente sugerido na triagem e o eSocial identificado", () => {
    const motivo = motivoDaCentral({ ...publicacao, sugestao_triagem: { cliente: "Empresa X" }, publicacao_esocial: "Acordo homologado" }, [prazo], "Ana Souza");
    expect(motivo).toContain("CLIENTE: Empresa X (sugestão da triagem)");
    expect(motivo).toContain("PUBLICAÇÃO - ESOCIAL: Acordo homologado");
    expect(motivoDaCentral({ ...publicacao, publicacao_esocial: "Não Identificado" }, [prazo], "Ana Souza")).not.toContain("ESOCIAL");
  });

  it("corta o teor que passa do limite do campo, avisando", () => {
    const motivo = motivoDaCentral({ ...publicacao, teor: "x".repeat(70_000) }, [prazo], "Ana Souza");
    expect(motivo.length).toBeLessThan(63_999);
    expect(motivo).toContain("[Publicação cortada");
  });
});

describe("processoNaCentral e link", () => {
  it("guarda o incidente junto ao número", () => {
    expect(processoNaCentral({ ...publicacao, processo_sufixo: "50002" })).toBe("1000000-00.2026.5.02.0001/50002");
  });

  it("sem número validado, usa o número como veio", () => {
    expect(processoNaCentral({ ...publicacao, numero_processo: null })).toBe("10000000020265020001");
  });

  it("aponta para o item na lista", () => {
    expect(linkDoItemNaCentral("64033")).toContain("/DispForm.aspx?ID=64033");
  });
});
