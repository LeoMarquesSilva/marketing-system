import { describe, expect, it } from "vitest";
import {
  ESCRITORIO_EX_CLIENTE,
  GRUPO_EX_CLIENTE,
  MOTIVO_EX_CLIENTE_SEM_ESCRITORIO,
  advogadosDoEscritorioCitados,
  chavePessoa,
  citaAdvogadoDoEscritorio,
  escritorioDaAreaDoProcesso,
  ehExCliente,
  ehPastaDeAtendimento,
  grupoDaPastaNaPublicacao,
  grupoPropostoNaTriagem,
  pastaInformada,
  tipoDaPastaDaPublicacao,
  triar,
  type PastaSioe,
} from "./triagem";

function pasta(extra: Partial<PastaSioe> = {}): PastaSioe {
  return {
    ci: "1000",
    cnj: "0001234-56.2026.5.15.0001",
    vinculo: null,
    cliente: "EMPRESA FICTICIA LTDA",
    grupoCliente: "Grupo Ficticio",
    area: "Trabalhista",
    advogadoResponsavel: "Advogada Exemplo",
    situacao: "Ativo",
    etiquetas: "Carteira Ficticia",
    ...extra,
  };
}

const AREAS = new Map([
  [chavePessoa("Advogada Exemplo"), "Trabalhista"],
  [chavePessoa("Advogado Insolvência"), "Reestruturação"],
  [chavePessoa("Advogado Ops"), "Operações Legais"],
]);
const areaDoAdvogado = (nome: string | null) => AREAS.get(chavePessoa(nome)) ?? null;

describe("triar", () => {
  it("libera para a área do advogado quando há uma pasta só", () => {
    expect(triar([pasta()], areaDoAdvogado)).toMatchObject({
      status: "juridico_vistar",
      pendencia: null,
      escritorio: "Trabalhista",
      demandaRisco: false,
    });
  });

  it("usa a área do advogado mesmo quando a área do processo é outra", () => {
    const resultado = triar([pasta({ area: "Tributário", advogadoResponsavel: "Advogado Ops" })], areaDoAdvogado);
    expect(resultado.escritorio).toBe("Operações Legais");
  });

  it("usa a área do processo quando o advogado não está nas tabelas", () => {
    const resultado = triar([pasta({ area: "Cível | Insolvência", advogadoResponsavel: "" })], areaDoAdvogado);
    expect(resultado).toMatchObject({ status: "juridico_vistar", escritorio: "Cível | Insolvência" });
  });

  it("divide o advogado da Reestruturação pela área de insolvência da pasta", () => {
    const advogado = "Advogado Insolvência";
    expect(triar([pasta({ area: "Insolvência", advogadoResponsavel: advogado })], areaDoAdvogado).escritorio).toBe("Insolvência");
    expect(triar([pasta({ area: "Cível | Insolvência", advogadoResponsavel: advogado })], areaDoAdvogado).escritorio).toBe("Cível | Insolvência");
    expect(triar([pasta({ area: "Tributário", advogadoResponsavel: advogado })], areaDoAdvogado).escritorio).toBe("Cível | Insolvência");
  });

  it("marca demanda de risco pela etiqueta", () => {
    expect(triar([pasta({ etiquetas: "Carteira X | Demanda de risco" })], areaDoAdvogado).demandaRisco).toBe(true);
  });

  it("etiqueta Crítico não é demanda de risco no padrão (16/11/2026)", () => {
    expect(triar([pasta({ etiquetas: "Carteira X | Crítico" })], areaDoAdvogado).demandaRisco).toBe(false);
    expect(triar([pasta({ etiquetas: "Crítico | Demanda de risco | Carteira X" })], areaDoAdvogado).demandaRisco).toBe(true);
  });

  it("etiqueta configurada em Configurações vale como demanda de risco, como palavra inteira", () => {
    const contexto = { etiquetasDeRisco: ["Demanda de risco", "Crítico"] };
    expect(triar([pasta({ etiquetas: "Carteira X | Crítico" })], areaDoAdvogado, contexto).demandaRisco).toBe(true);
    expect(triar([pasta({ etiquetas: "CRITICO" })], areaDoAdvogado, contexto).demandaRisco).toBe(true);
    // Palavra que só contém "critic" no meio não conta.
    expect(triar([pasta({ etiquetas: "Carteira Autocritica Ltda" })], areaDoAdvogado, contexto).demandaRisco).toBe(false);
    expect(triar([pasta({ etiquetas: "Carteira X" })], areaDoAdvogado, contexto).demandaRisco).toBe(false);
  });

  it("manda ex-cliente para Operações Legais", () => {
    const resultado = triar([pasta({ etiquetas: "Carteira Ex-Cliente", situacao: "Encerrado - Ex-Cliente" })], areaDoAdvogado);
    expect(resultado).toMatchObject({ status: "juridico_vistar", pendencia: "ex_cliente", escritorio: ESCRITORIO_EX_CLIENTE });
  });

  it("deixa pendente quando não há pasta", () => {
    expect(triar([], areaDoAdvogado)).toMatchObject({ status: "triagem_pendente", pendencia: "sem_pasta", pasta: null });
  });

  it("deixa pendente quando há mais de uma pasta e guarda as candidatas", () => {
    const resultado = triar([pasta(), pasta({ ci: "2000" })], areaDoAdvogado);
    expect(resultado).toMatchObject({ status: "triagem_pendente", pendencia: "varias_pastas" });
    expect(resultado.candidatas.map((c) => c.ci)).toEqual(["1000", "2000"]);
  });

  it("com várias pastas e só uma ativa, usa a ativa", () => {
    const resultado = triar(
      [pasta({ ci: "1000", situacao: "Arquivado definitivamente" }), pasta({ ci: "2000" }), pasta({ ci: "3000", situacao: "Encerrado - Ex-Cliente" })],
      areaDoAdvogado
    );
    expect(resultado).toMatchObject({ status: "juridico_vistar", pendencia: null, escritorio: "Trabalhista" });
    expect(resultado.pasta?.ci).toBe("2000");
    // com duas ativas, a controladoria escolhe
    expect(triar([pasta({ ci: "1000" }), pasta({ ci: "2000" }), pasta({ ci: "3000", situacao: "Baixado" })], areaDoAdvogado).pendencia).toBe("varias_pastas");
  });

  it("deixa pendente quando a pasta não tem grupo", () => {
    expect(triar([pasta({ grupoCliente: " " })], areaDoAdvogado)).toMatchObject({ status: "triagem_pendente", pendencia: "sem_grupo" });
  });

  it("deixa pendente quando não há área nenhuma", () => {
    expect(triar([pasta({ area: null, advogadoResponsavel: null })], areaDoAdvogado).pendencia).toBe("sem_area");
  });
});

describe("regras auxiliares", () => {
  it("reconhece ex-cliente no grupo, na etiqueta ou na situação", () => {
    expect(ehExCliente(pasta({ grupoCliente: "Grupo Ex Cliente" }))).toBe(true);
    expect(ehExCliente(pasta({ etiquetas: "Carteira Ex-Cliente | " }))).toBe(true);
    expect(ehExCliente(pasta({ situacao: "Encerrado - Ex-Cliente" }))).toBe(true);
    expect(ehExCliente(pasta({ cliente: "Texcliente SA" }))).toBe(false);
  });

  it("converte a área do processo em escritório", () => {
    expect(escritorioDaAreaDoProcesso("Insolvência")).toBe("Insolvência");
    expect(escritorioDaAreaDoProcesso("Civel | Insolvencia")).toBe("Cível | Insolvência");
    expect(escritorioDaAreaDoProcesso("Recuperação de Crédito")).toBe("Recuperação de Crédito");
    expect(escritorioDaAreaDoProcesso("")).toBeNull();
  });
});

describe("ex-cliente sem advogado do escritório", () => {
  const ex = pasta({ etiquetas: "Carteira Ex-Cliente" });

  it("descarta quando a publicação não cita o escritório", () => {
    expect(triar([ex], areaDoAdvogado, { citaEscritorio: false })).toMatchObject({
      status: "descartada",
      pendencia: "ex_cliente",
      motivoDescarte: MOTIVO_EX_CLIENTE_SEM_ESCRITORIO,
    });
  });

  it("mantém para a controladoria quando cita", () => {
    expect(triar([ex], areaDoAdvogado, { citaEscritorio: true })).toMatchObject({ status: "juridico_vistar", motivoDescarte: null });
  });

  it("não descarta clientes ativos que não citam o escritório", () => {
    expect(triar([pasta()], areaDoAdvogado, { citaEscritorio: false }).status).toBe("juridico_vistar");
  });

  it("reconhece o nome com quebra de linha, acento ou hífen e a OAB", () => {
    expect(citaAdvogadoDoEscritorio("ADV: GUSTAVO BISMARCHI MOT-\nTA (OAB 1/SP)")).toBe(true);
    expect(citaAdvogadoDoEscritorio("Ricardo  Viscardi Pires")).toBe(true);
    expect(citaAdvogadoDoEscritorio("GUSTAVO B. MOTTA (OAB 275.477/SP)")).toBe(true);
    expect(citaAdvogadoDoEscritorio("NOME:FULANO Nº OAB:353389 UF:SP")).toBe(true);
    expect(citaAdvogadoDoEscritorio("ADV: OUTRO ADVOGADO (OAB 1275477/SP)")).toBe(false);
    expect(citaAdvogadoDoEscritorio("ADV: OUTRO ADVOGADO (OAB 123456/SP)")).toBe(false);
  });

  it("diz quais advogados do escritório a publicação cita", () => {
    expect(advogadosDoEscritorioCitados("Adv - Ricardo Pires, Gustavo Bismarchi Motta => Sentença")).toEqual([
      { nome: "Gustavo Bismarchi Motta", oab: "275477" },
    ]);
    expect(advogadosDoEscritorioCitados("NOME:GUSTAVO BISMARCHI MOTTA Nº OAB:275477 UF:SP NOME:FULANO Nº OAB:353389 UF:SP").map((a) => a.nome)).toEqual([
      "Gustavo Bismarchi Motta",
      "Ricardo Viscardi Pires",
    ]);
    expect(advogadosDoEscritorioCitados("ADV: OUTRO ADVOGADO (OAB 123456/SP)")).toEqual([]);
  });
});

describe("pasta informada pela CI na Triagem Manual (18/11/2026)", () => {
  it("atendimento pela SAMA: o tipo, a área, o cliente e o grupo da pasta (CI 51762)", () => {
    const pasta = pastaInformada("51762", {
      tipo: "Atendimento",
      area: "Operações Legais",
      cnj: null,
      cliente: "Área Controladoria",
      grupoCliente: "Grupo Operações Legais",
    });
    expect(pasta).toMatchObject({ ci: "51762", cnj: "", tipoPasta: "Atendimento", area: "Operações Legais", cliente: "Área Controladoria", grupoCliente: "Grupo Operações Legais" });
    expect(ehPastaDeAtendimento(pasta.tipoPasta)).toBe(true);
  });

  it("sem tipo na SAMA: com número de processo nas tarefas é processo; sem, atendimento; sem nada, desconhecida", () => {
    const base = { tipo: null, area: "Cível", cliente: null, grupoCliente: null };
    expect(pastaInformada("61595", { ...base, cnj: "4170594-71.2026.8.26.0000" }).tipoPasta).toBe("Processo");
    expect(pastaInformada("52091", { ...base, cnj: null }).tipoPasta).toBe("Atendimento");
    expect(pastaInformada("99999", null)).toMatchObject({ ci: "99999", tipoPasta: "Desconhecido", area: null, cliente: null });
    expect(ehPastaDeAtendimento("Desconhecido")).toBe(true);
    expect(ehPastaDeAtendimento("Processo")).toBe(false);
    expect(ehPastaDeAtendimento(undefined)).toBe(false);
  });

  it("o tipo da pasta da publicação vem da candidata com a CI; as do SIOE (sem tipo) são processo", () => {
    const atendimento = pastaInformada("51762", null);
    const doSioe = { ci: "56927", cnj: "4008196-14.2025.8.26.0001" } as PastaSioe;
    expect(tipoDaPastaDaPublicacao({ pasta_ci: "51762", pastas_candidatas: [doSioe, atendimento] })).toBe("Desconhecido");
    expect(tipoDaPastaDaPublicacao({ pasta_ci: "56927", pastas_candidatas: [doSioe, atendimento] })).toBe("Processo");
    expect(tipoDaPastaDaPublicacao({ pasta_ci: "56927", pastas_candidatas: null })).toBe("Processo");
    expect(tipoDaPastaDaPublicacao({ pasta_ci: null, pastas_candidatas: [atendimento] })).toBe("Processo");
  });
});

describe("grupo na Triagem Manual (24/11/2026: Operações Legais fica com o Grupo Ex-Cliente)", () => {
  it("o grupo do atendimento da controladoria (CI 51762) vira Grupo Ex-Cliente; os outros ficam como estão", () => {
    expect(grupoDaPastaNaPublicacao("Grupo Operações Legais")).toBe(GRUPO_EX_CLIENTE);
    expect(grupoDaPastaNaPublicacao("  grupo operacoes legais ")).toBe(GRUPO_EX_CLIENTE);
    expect(grupoDaPastaNaPublicacao("Grupo Colombo")).toBe("Grupo Colombo");
    expect(grupoDaPastaNaPublicacao("  ")).toBeNull();
    expect(grupoDaPastaNaPublicacao(null)).toBeNull();
  });

  it("0049237-61: sugestão da IA sem grupo + CI 51762 → Grupo Ex-Cliente, não mais Grupo Operações Legais (sugerido)", () => {
    expect(grupoPropostoNaTriagem({ escritorio: "Insolvência", grupoDaPasta: "Grupo Operações Legais", grupoDaSugestao: null })).toBe(GRUPO_EX_CLIENTE);
    expect(grupoPropostoNaTriagem({ escritorio: ESCRITORIO_EX_CLIENTE, grupoDaPasta: "Grupo Operações Legais", grupoDaSugestao: null })).toBe(GRUPO_EX_CLIENTE);
  });

  it("sugestão pela parte com o grupo do cliente + Operações Legais → Grupo Ex-Cliente (era trocado à mão)", () => {
    expect(grupoPropostoNaTriagem({ escritorio: ESCRITORIO_EX_CLIENTE, grupoDaPasta: null, grupoDaSugestao: "Grupo Colombo" })).toBe(GRUPO_EX_CLIENTE);
    expect(grupoPropostoNaTriagem({ escritorio: ESCRITORIO_EX_CLIENTE, grupoDaPasta: "Grupo Operações Legais", grupoDaSugestao: "Grupo BMF" })).toBe(
      GRUPO_EX_CLIENTE
    );
  });

  it("a pasta com grupo de verdade manda; nas outras áreas, sem pasta, vale a sugestão", () => {
    expect(grupoPropostoNaTriagem({ escritorio: ESCRITORIO_EX_CLIENTE, grupoDaPasta: "Grupo Teixeira", grupoDaSugestao: "Grupo Colombo" })).toBe("Grupo Teixeira");
    expect(grupoPropostoNaTriagem({ escritorio: "Cível", grupoDaPasta: null, grupoDaSugestao: "Grupo Colombo" })).toBe("Grupo Colombo");
    expect(grupoPropostoNaTriagem({ escritorio: "Cível", grupoDaPasta: null, grupoDaSugestao: null })).toBe("");
    expect(grupoPropostoNaTriagem({ escritorio: "", grupoDaPasta: undefined, grupoDaSugestao: undefined })).toBe("");
  });
});
