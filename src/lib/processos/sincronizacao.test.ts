import { describe, expect, it } from "vitest";
import { calcularPreenchimento } from "./preenchimento";
import { chaveDaParte, estaNoRecorte, lerRecorte, mesclarComVios } from "./sincronizacao";
import type { Parte } from "./types";

describe("mesclarComVios", () => {
  it("na primeira carga grava tudo e não gera histórico", () => {
    const resultado = mesclarComVios(null, { ci: "1", fase: "Execução", valor_acao: 10 }, new Map());
    expect(resultado.patch).toEqual({ ci: "1", fase: "Execução", valor_acao: 10 });
    expect(resultado.mudancas).toEqual([]);
  });

  it("aplica o que mudou no VIOS e registra no histórico", () => {
    const atual = { fase: "Conhecimento", valor_acao: 10, etiquetas: ["A"], uf: "SP" };
    const resultado = mesclarComVios(atual, { fase: "Execução", valor_acao: "10.00", etiquetas: ["A"] }, new Map());
    expect(resultado.patch).toEqual({ fase: "Execução" });
    expect(resultado.mudancas).toEqual([{ campo: "fase", anterior: "Conhecimento", novo: "Execução" }]);
  });

  it("não toca no campo que a fonte não trouxe", () => {
    const resultado = mesclarComVios({ fase: "Execução", cidade: "Campinas" }, { fase: "Execução" }, new Map());
    expect(resultado.patch).toEqual({});
  });

  it("mantém a edição daqui enquanto o VIOS não gravou", () => {
    const atual = { fase: "Execução" };
    const resultado = mesclarComVios(atual, { fase: "Conhecimento" }, new Map([["fase", "Execução"]]));
    expect(resultado.patch).toEqual({});
    expect(resultado.confirmados).toEqual([]);
  });

  it("confirma o envio quando o VIOS passa a trazer o valor pedido", () => {
    const resultado = mesclarComVios({ fase: "Execução" }, { fase: "Execução" }, new Map([["fase", "Execução"]]));
    expect(resultado.confirmados).toEqual(["fase"]);
    expect(resultado.patch).toEqual({});
  });

  it("limpa o campo que ficou vazio no VIOS", () => {
    const resultado = mesclarComVios({ pasta_interna: "X - 1" }, { pasta_interna: null }, new Map());
    expect(resultado.patch).toEqual({ pasta_interna: null });
    expect(resultado.mudancas).toEqual([{ campo: "pasta_interna", anterior: "X - 1", novo: "" }]);
  });

  it("atualiza a data de edição do VIOS sem histórico", () => {
    const resultado = mesclarComVios({ vios_editado_em: "01/11/2026" }, { vios_editado_em: "09/11/2026" }, new Map());
    expect(resultado.patch).toEqual({ vios_editado_em: "09/11/2026" });
    expect(resultado.mudancas).toEqual([]);
  });
});

describe("recorte da carga", () => {
  it("o padrão é o piloto", () => {
    expect(lerRecorte({})).toEqual({ areas: ["Recuperação de Crédito"], grupos: ["Grupo PST"] });
  });

  it("aceita lista e asterisco", () => {
    expect(lerRecorte({ PROCESSOS_AREAS: "Cível, Trabalhista", PROCESSOS_GRUPOS: "*" })).toEqual({ areas: ["Cível", "Trabalhista"], grupos: null });
  });

  it("compara sem acento nem caixa", () => {
    const recorte = lerRecorte({});
    expect(estaNoRecorte({ area: "RECUPERACAO DE CREDITO", grupo_cliente: "grupo pst" }, recorte)).toBe(true);
    expect(estaNoRecorte({ area: "Recuperação de Crédito", grupo_cliente: "Grupo Outro" }, recorte)).toBe(false);
    expect(estaNoRecorte({ area: null, grupo_cliente: "Grupo PST" }, recorte)).toBe(false);
  });

  it("reconhece a mesma parte", () => {
    expect(chaveDaParte("passivo", "  João  da Silva ")).toBe(chaveDaParte("passivo", "JOAO DA SILVA"));
    expect(chaveDaParte("ativo", "João da Silva")).not.toBe(chaveDaParte("passivo", "João da Silva"));
  });
});

function parte(dados: Partial<Parte>): Parte {
  return {
    id: "p1",
    polo: "passivo",
    papel: "parte",
    vinculo: null,
    devedor: false,
    referenteA: null,
    origem: "manual",
    pessoaId: "x",
    nome: "Fulano",
    documento: null,
    oab: null,
    observacao: null,
    enderecos: [],
    contatos: [],
    ...dados,
  };
}

describe("calcularPreenchimento", () => {
  it("conta campo simples e item de parte", () => {
    const vazio = calcularPreenchimento({}, []);
    expect(vazio.feitos).toBe(0);
    expect(vazio.percentual).toBe(0);

    const devedor = parte({ id: "d", devedor: true, documento: "12.345.678/0001-90", enderecos: [{ endereco: "Rua A, 1", cidade: null, uf: null, cep: null, observacao: null }] });
    const advogado = parte({ id: "a", papel: "advogado", referenteA: "d", oab: "SP 123" });
    const resultado = calcularPreenchimento({ ci: "1", cnj: "x" }, [devedor, advogado]);
    const estado = (chave: string) => resultado.itens.find((item) => item.chave === chave)?.estado;
    expect(estado("ci")).toBe("ok");
    expect(estado("parte_passiva")).toBe("ok");
    expect(estado("parte_passiva_documento")).toBe("ok");
    expect(estado("executado_enderecos")).toBe("ok");
    expect(estado("executado_contatos")).toBe("falta");
    expect(estado("advogado_executado")).toBe("ok");
    expect(estado("advogado_executado_contatos")).toBe("falta");
    expect(estado("parte_ativa")).toBe("falta");
  });

  it("sem devedor indicado, os itens do executado ficam pendentes", () => {
    const resultado = calcularPreenchimento({}, [parte({ enderecos: [{ endereco: "Rua A", cidade: null, uf: null, cep: null, observacao: null }] })]);
    expect(resultado.itens.find((item) => item.chave === "executado_enderecos")?.estado).toBe("falta");
  });

  it("não cobra item opcional vazio nem data de encerramento de processo ativo", () => {
    const estado = (valores: Record<string, string | null>, chave: string) => calcularPreenchimento(valores, []).itens.find((item) => item.chave === chave);
    expect(estado({}, "outros_numeros")).toMatchObject({ estado: "nao_se_aplica", automatico: true });
    expect(estado({}, "valor_acordo")?.estado).toBe("nao_se_aplica");
    expect(estado({ situacao: "Ativo" }, "data_encerramento")?.estado).toBe("nao_se_aplica");
    expect(estado({ situacao: "Arquivado definitivamente" }, "data_encerramento")?.estado).toBe("falta");
    expect(estado({ situacao: "Ativo", data_encerramento: "2026-01-10" }, "data_encerramento")?.estado).toBe("ok");
  });

  it("tira da conta o que não se aplica", () => {
    const base = calcularPreenchimento({}, []);
    const comExcecao = calcularPreenchimento({}, [], ["corresponsaveis", "data_citacao"]);
    expect(comExcecao.total).toBe(base.total - 2);
    expect(comExcecao.itens.find((item) => item.chave === "corresponsaveis")?.estado).toBe("nao_se_aplica");
  });

  it("segue a ordem da lista da equipe: partes depois do polo do cliente", () => {
    const chaves = calcularPreenchimento({}, []).itens.map((item) => item.chave);
    expect(chaves.indexOf("parte_ativa")).toBe(chaves.indexOf("polo_cliente") + 1);
    expect(chaves[0]).toBe("ci");
  });
});
