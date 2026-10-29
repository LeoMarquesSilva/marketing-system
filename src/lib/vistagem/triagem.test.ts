import { describe, expect, it } from "vitest";
import {
  ESCRITORIO_EX_CLIENTE,
  MOTIVO_EX_CLIENTE_SEM_ESCRITORIO,
  chavePessoa,
  citaAdvogadoDoEscritorio,
  escritorioDaAreaDoProcesso,
  ehExCliente,
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
});
