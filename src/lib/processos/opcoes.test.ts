import { describe, expect, it } from "vitest";
import { chaveDaOpcao, normalizar, opcoesParaCampo, poloDoTipo, ufDoEstado, type Opcao } from "./opcoes";

const opcao = (valor: string, extra: Record<string, unknown> = {}, ativo = true): Opcao => ({ id: valor, lista: "cidade", valor, viosCi: null, extra, ativo, origem: "vios" });

describe("opções dos campos de escolha", () => {
  it("normaliza caixa, acento e espaços", () => {
    expect(normalizar("  Justiça   ESTADUAL ")).toBe("justica estadual");
    expect(chaveDaOpcao("justica", "Justiça Estadual")).toBe(chaveDaOpcao("justica", "JUSTICA estadual"));
  });

  it("põe a UF na chave das listas por UF", () => {
    expect(chaveDaOpcao("cidade", "Cidade Exemplo", "sp")).toBe("cidade exemplo|SP");
    expect(chaveDaOpcao("cidade", "Cidade Exemplo", "mg")).not.toBe(chaveDaOpcao("cidade", "Cidade Exemplo", "sp"));
    expect(chaveDaOpcao("area", "Cível", "SP")).toBe("civel");
  });

  it("converte o nome do estado em UF", () => {
    expect(ufDoEstado("São Paulo")).toBe("SP");
    expect(ufDoEstado("rj")).toBe("RJ");
    expect(ufDoEstado("Atlântida")).toBeNull();
  });

  it("separa o polo do tipo de parte", () => {
    expect(poloDoTipo("Parte Ativa")).toBe("ativo");
    expect(poloDoTipo("Parte Passiva")).toBe("passivo");
    expect(poloDoTipo("Terceiro interessado")).toBe("terceiro");
  });

  it("mostra primeiro as opções da UF, esconde as desativadas e mantém o valor atual fora da lista", () => {
    const lista = [opcao("Vila Alfa", { uf: "MG" }), opcao("Vila Beta", { uf: "SP" }), opcao("Vila Gama", { uf: "SP" }, false)];
    const resultado = opcoesParaCampo(lista, "Vila Antiga", "SP");
    expect(resultado.map((item) => item.valor)).toEqual(["Vila Antiga", "Vila Beta", "Vila Alfa"]);
    expect(resultado[0].descricao).toBe("fora da lista");
    expect(resultado[2].descricao).toBe("MG");
  });
});
