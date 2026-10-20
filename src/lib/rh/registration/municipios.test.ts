import { describe, expect, it } from "vitest";
import { cleanBankName, matchBank, normalizeBanks, POPULAR_BANKS } from "./bancos";
import { filterOptions } from "./combo-search";
import { cityKey, matchCity, titleCaseCity } from "./municipios";

const SP = ["Campinas", "Campo Limpo Paulista", "Hortolândia", "Santa Bárbara d'Oeste", "São Paulo", "Sumaré"];
const SP_OPTIONS = SP.map((value) => ({ value }));

describe("municípios", () => {
  it("compara sem acento e sem caixa", () => {
    expect(cityKey("  São   Paulo ")).toBe("sao paulo");
    expect(matchCity("sao paulo", SP)).toBe("São Paulo");
    expect(matchCity("HORTOLANDIA", SP)).toBe("Hortolândia");
    expect(matchCity("Campinass", SP)).toBeNull();
  });

  it("deixa os nomes da reserva (caixa alta) no formato oficial", () => {
    expect(titleCaseCity("SÃO JOÃO DA BOA VISTA")).toBe("São João da Boa Vista");
    expect(titleCaseCity("SANTA BÁRBARA D'OESTE")).toBe("Santa Bárbara d'Oeste");
    expect(titleCaseCity("EMBU-GUAÇU")).toBe("Embu-Guaçu");
  });
});

describe("busca das listas", () => {
  it("começa com o termo, depois palavra que começa, depois contém", () => {
    const values = (query: string) => filterOptions(query, SP_OPTIONS).map((option) => option.value);
    expect(values("camp")).toEqual(["Campinas", "Campo Limpo Paulista"]);
    expect(values("paul")).toEqual(["Campo Limpo Paulista", "São Paulo"]);
    expect(values("sao")).toEqual(["São Paulo"]);
    expect(values("olandia")).toEqual(["Hortolândia"]);
  });

  it("acha o banco pelo código", () => {
    const options = [
      { value: "Itaú Unibanco (341)", label: "Itaú Unibanco", keywords: "341 341" },
      { value: "Banco do Brasil (001)", label: "Banco do Brasil", keywords: "1 001" },
    ];
    expect(filterOptions("341", options).map((option) => option.label)).toEqual(["Itaú Unibanco"]);
    expect(filterOptions("001", options).map((option) => option.label)).toEqual(["Banco do Brasil"]);
  });
});

describe("bancos", () => {
  it("limpa os nomes crus da lista do Banco Central", () => {
    expect(cleanBankName("BCO BRADESCO S.A.")).toBe("Banco Bradesco");
    expect(cleanBankName("BCO SANTANDER (BRASIL) S.A.")).toBe("Banco Santander (Brasil)");
    expect(cleanBankName("BRB - BCO DE BRASILIA S.A.")).toBe("BRB - Banco de Brasilia");
    expect(cleanBankName("NU PAGAMENTOS - IP")).toBe("Nu Pagamentos - IP");
    expect(cleanBankName("BANCO SUL AMERICANO LTDA.")).toBe("Banco Sul Americano");
  });

  it("os mais usados ganham o nome amigável", () => {
    const banks = normalizeBanks([
      { code: 260, name: "NU PAGAMENTOS - IP" },
      { code: 237, name: "BCO BRADESCO S.A." },
      { code: 999, name: "BCO EXEMPLO S.A." },
      { code: null, name: "SEM CODIGO" },
    ]);
    expect(banks).toEqual([
      { code: 999, name: "Banco Exemplo" },
      { code: 237, name: "Bradesco" },
      { code: 260, name: "Nubank" },
    ]);
  });

  it("reconhece o que já estava salvo pelo código ou pelo nome", () => {
    expect(matchBank("Itaú (341)", POPULAR_BANKS)).toBe("Itaú Unibanco (341)");
    expect(matchBank("nubank", POPULAR_BANKS)).toBe("Nubank (260)");
    expect(matchBank("Banco X", POPULAR_BANKS)).toBeNull();
  });
});
