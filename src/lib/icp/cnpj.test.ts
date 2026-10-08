import { describe, expect, it } from "vitest";
import { cnaeSector, onlyCnpjDigits, parseBrasilApi, parseOpenCnpj, pickReferenceCompany, type IcpCnpjRecord } from "@/lib/icp/cnpj";
import { computeIcp, type IcpInput } from "@/lib/icp/compute";

const NOW = new Date("2026-10-01T12:00:00Z");

function record(overrides: Partial<IcpCnpjRecord>): IcpCnpjRecord {
  return {
    ...parseOpenCnpj("00000000000100", {}, NOW),
    ...overrides,
  };
}

describe("cadastro de CNPJ", () => {
  it("aceita só CNPJ com 14 dígitos", () => {
    expect(onlyCnpjDigits("12.345.678/0001-90")).toBe("12345678000190");
    expect(onlyCnpjDigits("123.456.789-01")).toBeNull();
  });

  it("lê a resposta da OpenCNPJ", () => {
    const r = parseOpenCnpj(
      "33000167000101",
      {
        razao_social: "EMPRESA TESTE LTDA",
        situacao_cadastral: "Ativa",
        matriz_filial: "Matriz",
        cnaes: [
          { codigo: "2229399", descricao: "Fabricação de artefatos de material plástico", is_principal: true },
          { codigo: "4686902", descricao: "Comércio atacadista de embalagens", is_principal: false },
        ],
        capital_social: "1.250.000,50",
        porte_empresa: "Demais",
        opcao_simples: "N",
        uf: "sp",
        municipio: "CAMPINAS",
        QSA: [{ nome_socio: "FULANA DE TAL", qualificacao_socio: "Sócio-Administrador", data_entrada_sociedade: "2010-01-01" }],
      },
      NOW
    );
    expect(r).toMatchObject({
      status: "ok",
      situacao_cadastral: "ATIVA",
      matriz: true,
      cnae_principal: "2229399",
      cnae_descricao: "Fabricação de artefatos de material plástico",
      capital_social: 1_250_000.5,
      porte: "DEMAIS",
      opcao_simples: false,
      uf: "SP",
      source: "opencnpj",
    });
    expect(r.cnaes_secundarios).toEqual([{ codigo: "4686902", descricao: "Comércio atacadista de embalagens" }]);
    expect(r.socios).toEqual([{ nome: "FULANA DE TAL", qualificacao: "Sócio-Administrador", desde: "2010-01-01" }]);
  });

  it("lê a resposta da BrasilAPI", () => {
    const r = parseBrasilApi(
      "33000167000101",
      { cnae_fiscal: 600001, cnae_fiscal_descricao: "Extração de petróleo", identificador_matriz_filial: 2, capital_social: 1000 },
      NOW
    );
    expect(r).toMatchObject({ cnae_principal: "0600001", matriz: false, capital_social: 1000, source: "brasilapi" });
  });

  it("agrupa o CNAE em macrossetores", () => {
    expect(cnaeSector("2229399")).toBe("Indústria");
    expect(cnaeSector("4686902")).toBe("Comércio e distribuição");
    expect(cnaeSector("6462000")).toBe("Holdings e participações");
    expect(cnaeSector("6422100")).toBe("Financeiro e crédito");
    expect(cnaeSector("0111301")).toBe("Agronegócio");
    expect(cnaeSector(null)).toBeNull();
  });

  it("escolhe a empresa ativa e operacional como referência, antes da holding e da filial", () => {
    const holding = record({ cnpj: "1", situacao_cadastral: "ATIVA", cnae_principal: "6462000", matriz: true, capital_social: 9e6 });
    const filial = record({ cnpj: "2", situacao_cadastral: "ATIVA", cnae_principal: "2229399", matriz: false, capital_social: 5e6 });
    const fabrica = record({ cnpj: "3", situacao_cadastral: "ATIVA", cnae_principal: "2229399", matriz: true, capital_social: 1e6 });
    const baixada = record({ cnpj: "4", situacao_cadastral: "BAIXADA", cnae_principal: "2229399", matriz: true, capital_social: 9e9 });
    expect(pickReferenceCompany([holding, filial, fabrica, baixada])?.cnpj).toBe("3");
    expect(pickReferenceCompany([record({ status: "not_found" })])).toBeNull();
  });

  it("usa o cadastro da Receita no segmento, na sede (com o acento do VIOS), no porte e nos sócios", () => {
    const input: IcpInput = {
      now: NOW,
      revenue: [{ grupo: "Grupo Alfa", departamento: "Cível", planoContas: "HONORÁRIOS MENSAIS", valor: 100_000, dataPagamento: "2026-03-10" }],
      excludedPayers: { count: 0, revenue: 0 },
      processes: [],
      pessoas: [
        { grupo: "Grupo Alfa", tipo: "PESSOA JURÍDICA", uf: "SP", cidade: "São Paulo", categoria: "Cliente ativo" },
        { grupo: "Grupo Beta", tipo: "PESSOA JURÍDICA", uf: "SP", cidade: "SÃO JOSÉ DO RIO PRETO", categoria: "Cliente ativo" },
      ],
      overdue: [],
      hours: [],
      personnelCost: [],
      companies: [
        {
          grupo: "Grupo Alfa",
          categoria: "Cliente ativo",
          record: record({
            cnpj: "3",
            situacao_cadastral: "ATIVA",
            cnae_principal: "2229399",
            cnae_descricao: "Fabricação de artefatos de material plástico",
            matriz: true,
            porte: "EMPRESA DE PEQUENO PORTE",
            uf: "SP",
            municipio: "SAO JOSE DO RIO PRETO",
            socios: [
              { nome: "FULANA DE TAL", qualificacao: "Sócio-Administrador", desde: null },
              { nome: "BELTRANO", qualificacao: "Sócio", desde: null },
            ],
          }),
        },
      ],
      nps: [],
      npsThemes: [],
      linkedin: [],
      ga4Cities: [],
      whatsapp: [],
    };
    const [alfa] = computeIcp(input).groups;
    expect(alfa).toMatchObject({
      sectorBucket: "Indústria",
      sector: "Fabricação de artefatos de material plástico",
      registeredSize: "EPP",
      city: "São José do Rio Preto",
      uf: "SP",
      regionSource: "receita",
      cnpjs: 1,
    });
    expect(alfa.decisionMakers).toEqual([{ nome: "Fulana de Tal", qualificacao: "Sócio-Administrador" }]);
  });
});
