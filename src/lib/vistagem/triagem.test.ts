import { describe, expect, it } from "vitest";
import { ESCRITORIO_EX_CLIENTE, chavePessoa, escritorioDaAreaDoProcesso, ehExCliente, triar, type PastaSioe } from "./triagem";

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
    expect(resultado).toMatchObject({ status: "juridico_vistar", escritorio: "Reestruturação" });
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
    expect(escritorioDaAreaDoProcesso("Insolvência")).toBe("Reestruturação");
    expect(escritorioDaAreaDoProcesso("Recuperação de Crédito")).toBe("Recuperação de Crédito");
    expect(escritorioDaAreaDoProcesso("")).toBeNull();
  });
});
