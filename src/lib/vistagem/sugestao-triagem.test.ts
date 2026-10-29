import { describe, expect, it } from "vitest";
import {
  chaveCliente,
  instrucoesSugestaoTriagem,
  numerosCitados,
  sugestaoDaIa,
  sugestaoPorNumero,
  sugestaoPorPartes,
  type RespostaTriagemIa,
} from "./sugestao-triagem";
import type { PastaSioe } from "./triagem";

function pasta(campos: Partial<PastaSioe>): PastaSioe {
  return {
    ci: "1",
    cnj: "0000000-00.2026.8.26.0000",
    vinculo: null,
    cliente: "Cliente",
    grupoCliente: "Grupo Cliente",
    area: "Cível",
    advogadoResponsavel: "Advogada Cível",
    situacao: "Ativo",
    etiquetas: null,
    ...campos,
  };
}

const area = (nome: string | null) => (nome === "Advogada Trabalhista" ? "Trabalhista" : nome === "Advogada Cível" ? "Cível" : null);

describe("numerosCitados", () => {
  it("acha os outros CNJ do teor, sem repetir o da publicação", () => {
    const teor = "Agravo 0002099-85.2026.8.26.0048 nos autos 1004427-73.2023.8.26.0048 e 10044277320238260048";
    expect(numerosCitados(teor, "0002099-85.2026.8.26.0048")).toEqual(["10044277320238260048"]);
  });
});

describe("chaveCliente", () => {
  it("ignora acentos, pontuação, tipo societário e recuperação judicial", () => {
    expect(chaveCliente("CENTURION SEGURANCA E VIGILANCIA LTDA - EM RECUPERACAO JUDICIAL")).toBe(chaveCliente("Centurion Segurança e Vigilância Ltda."));
    expect(chaveCliente("BFD COMERCIO DE ALIMENTOS S.A.")).toBe(chaveCliente("BFD Comércio de Alimentos S/A"));
    expect(chaveCliente("Banco do Brasil S/A")).not.toBe(chaveCliente("Banco Bradesco S/A"));
  });
});

describe("sugestaoPorNumero", () => {
  it("usa grupo, escritório e demanda de risco da pasta do processo citado", () => {
    const sugestao = sugestaoPorNumero("10044277320238260048", [pasta({ ci: "52758", cliente: "Conduscabos", grupoCliente: "Grupo Conduscabos", etiquetas: "Demanda de risco" })], area);
    expect(sugestao).toMatchObject({ origem: "numero", escritorio: "Cível", grupo: "Grupo Conduscabos", demandaRisco: true, confianca: "alta" });
    expect(sugestao.motivo).toContain("1004427-73.2023.8.26.0048");
  });

  it("pasta de ex-cliente vai para Operações Legais", () => {
    const sugestao = sugestaoPorNumero("10044277320238260048", [pasta({ grupoCliente: "Grupo Ex-Cliente", situacao: "Encerrado - Ex-Cliente" })], area);
    expect(sugestao.escritorio).toBe("Operações Legais");
  });
});

describe("sugestaoPorPartes", () => {
  const porCliente = new Map([
    [chaveCliente("Mix Etiquetas e Rótulos Ltda"), [pasta({ cliente: "Mix Etiquetas e Rótulos Ltda", grupoCliente: "Grupo Mix Etiquetas", advogadoResponsavel: "Advogada Trabalhista" }), pasta({ ci: "2", cliente: "Mix Etiquetas e Rótulos Ltda", grupoCliente: "Grupo Mix Etiquetas", advogadoResponsavel: "Advogada Trabalhista" })]],
    [chaveCliente("Banco Santander"), [pasta({ cliente: "Banco Santander", grupoCliente: "Grupo Santander", situacao: "Encerrado" })]],
  ]);

  it("escolhe a parte com mais processos ativos e copia o grupo e o escritório mais comuns", () => {
    const sugestao = sugestaoPorPartes(["BANCO SANTANDER (BRASIL) S.A.", "MIX ETIQUETAS E ROTULOS LTDA"], porCliente, area);
    expect(sugestao).toMatchObject({ origem: "parte", grupo: "Grupo Mix Etiquetas", escritorio: "Trabalhista", cliente: "MIX ETIQUETAS E ROTULOS LTDA" });
  });

  it("sem cliente entre as partes, não sugere", () => {
    expect(sugestaoPorPartes(["Fulano de Tal"], porCliente, area)).toBeNull();
  });
});

describe("sugestão da IA", () => {
  const grupos = [{ grupo: "Grupo Mix Etiquetas", clientes: ["Mix Etiquetas e Rótulos Ltda"] }];
  const resposta: RespostaTriagemIa = {
    cliente: "Mix Etiquetas",
    grupo: "Grupo Mix Etiquetas",
    escritorio: "Cível",
    processo_principal: null,
    demanda_risco: false,
    confianca: "media",
    motivo: "Intimação do advogado da Mix Etiquetas.",
  };

  it("as instruções levam a lista de grupos", () => {
    expect(instrucoesSugestaoTriagem(grupos)).toContain("Grupo Mix Etiquetas: Mix Etiquetas e Rótulos Ltda");
  });

  it("com grupo da lista, o escritório vem dos processos do grupo", () => {
    expect(sugestaoDaIa(resposta, grupos, { escritorioDoGrupo: "Trabalhista", custoUS: 0.0004 })).toMatchObject({ origem: "ia", grupo: "Grupo Mix Etiquetas", escritorio: "Trabalhista", confianca: "media" });
  });

  it("grupo fora da lista é descartado e a confiança cai", () => {
    expect(sugestaoDaIa({ ...resposta, grupo: "Grupo Inventado" }, grupos, { escritorioDoGrupo: null, custoUS: 0 })).toMatchObject({ grupo: null, escritorio: "Cível", confianca: "baixa" });
  });
});
