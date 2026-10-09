import { describe, expect, it } from "vitest";
import {
  computeIcp,
  normalizePracticeArea,
  sizeBuckets,
  type IcpInput,
} from "@/lib/icp/compute";

const NOW = new Date("2026-10-01T12:00:00Z");

function baseInput(overrides: Partial<IcpInput> = {}): IcpInput {
  return {
    now: NOW,
    revenue: [],
    excludedPayers: { count: 0, revenue: 0 },
    processes: [],
    pessoas: [],
    overdue: [],
    hours: [],
    personnelCost: [],
    companies: [],
    nps: [],
    npsThemes: [],
    linkedin: [],
    ga4Cities: [],
    whatsapp: [],
    ...overrides,
  };
}

const pay = (grupo: string, departamento: string, valor: number, planoContas = "HONORÁRIOS MENSAIS", dataPagamento = "2026-03-10") => ({
  grupo,
  departamento,
  planoContas,
  valor,
  dataPagamento,
});

describe("icp helpers", () => {
  it("normaliza áreas de prática do VIOS", () => {
    expect(normalizePracticeArea("Cível | Insolvência")).toBe("Insolvência");
    expect(normalizePracticeArea("InsolvÃªncia")).toBe("Insolvência");
    expect(normalizePracticeArea("Special Situations")).toBe("Distressed Deals");
    expect(normalizePracticeArea("Facilities")).toBeNull();
  });
});

describe("computeIcp", () => {
  it("classifica faixas e concentração só com pagamentos dos últimos 12 meses", () => {
    const data = computeIcp(
      baseInput({
        revenue: [
          pay("Grupo Alfa", "Insolvência", 150_000),
          pay("Grupo Alfa", "Trabalhista", 60_000),
          pay("Grupo Alfa", "Cível", 40_000),
          pay("Grupo Beta", "Cível", 80_000, "HONORÁRIOS SPOT"),
          pay("Grupo Gama", "Trabalhista", 10_000, "HONORÁRIOS DE ÊXITO"),
          pay("Grupo Gama", "Trabalhista", 500_000, "HONORÁRIOS MENSAIS", "2025-08-01"),
        ],
      })
    );

    expect(data.windowStart).toBe("2025-10-01");
    expect(data.totals.revenue12m).toBe(340_000);
    expect(data.groups.map((g) => [g.grupo, g.tier])).toEqual([
      ["Grupo Alfa", "A"],
      ["Grupo Beta", "B"],
      ["Grupo Gama", "D"],
    ]);
    expect(data.totals.groupsFor50).toBe(1);
    expect(data.totals.coreGroups).toBe(2);
    expect(data.groups[0].areas).toEqual(["Insolvência", "Trabalhista", "Cível"]);
    expect(data.groups[0].hasRetainer).toBe(true);
    expect(data.groups[1].hasRetainer).toBe(false);
    expect(data.breadth.find((b) => b.label === "3 ou mais")?.groups).toBe(1);
  });

  it("usa o primeiro processo como porta de entrada e a pessoa jurídica do grupo", () => {
    const data = computeIcp(
      baseInput({
        revenue: [pay("Grupo Alfa", "Insolvência", 250_000)],
        processes: [
          { grupo: "Grupo Alfa", area: "Trabalhista", dataCadastro: "2025-05-01" },
          { grupo: "Grupo Alfa", area: "Cível | Insolvência", dataCadastro: "2025-02-01" },
        ],
        pessoas: [
          { grupo: "Grupo Alfa", tipo: "PESSOA JURÍDICA", uf: "SP", cidade: "Campinas", categoria: "Cliente ativo" },
          { grupo: "Grupo Alfa", tipo: "PESSOA FÍSICA", uf: "SP", cidade: "NÃO INFORMADA", categoria: "Contrário ativo" },
        ],
      })
    );

    const alfa = data.groups[0];
    expect(alfa.entryArea).toBe("Cível | Insolvência");
    expect(alfa.activeSince2025).toBe(true);
    expect(alfa.city).toBe("Campinas");
    expect(alfa.hasLegalEntity).toBe(true);
    // Sem CNPJ consultado, o grupo fica sem segmento e porte.
    expect(alfa.sectorBucket).toBeNull();
    expect(alfa.registeredSize).toBeNull();
    expect(data.entry.coreViaInsolvency).toBe(1);
    expect(data.newCore).toEqual({ total: 1, viaInsolvency: 1 });
    expect(data.geography.coreInterior).toBe(1);
  });

  it("calcula NPS, decisor e sinais de marketing", () => {
    const data = computeIcp(
      baseInput({
        nps: [
          { cargo: "Sócio(a) / Proprietário(a)", recommend: 10 },
          { cargo: "Financeiro", recommend: 9 },
          { cargo: null, recommend: 5 },
        ],
        npsThemes: [
          { id: "relacionamento", polarity: "strength" },
          { id: "disponibilidade", polarity: "pain" },
        ],
        linkedin: [
          { reportType: "followers", dimension: "industry", label: "Serviços advocatícios", value: 60 },
          { reportType: "followers", dimension: "industry", label: "Fabricação de produtos de material plástico", value: 10 },
          { reportType: "followers", dimension: "industry", label: "Bancos", value: 30 },
          { reportType: "followers", dimension: "seniority", label: "Diretor", value: 5 },
          { reportType: "followers", dimension: "seniority", label: "Sênior", value: 95 },
        ],
        whatsapp: [
          { leadSource: "meta_ads", pipelineStage: "lead_recebido" },
          { leadSource: null, pipelineStage: "qualificado" },
        ],
      })
    );

    expect(data.decisor.nps).toBe(33);
    expect(data.decisor.ownerResponses).toBe(1);
    expect(data.decisor.financeOrDirector).toBe(1);
    expect(data.decisor.strengths).toEqual([{ label: "Relacionamento", count: 1 }]);
    expect(data.marketing.linkedinLegalShare).toBeCloseTo(0.6);
    expect(data.marketing.linkedinIndustryShare).toBeCloseTo(0.1);
    expect(data.marketing.linkedinDecisionShare).toBeCloseTo(0.05);
    expect(data.marketing.whatsappUnqualified).toBe(1);
  });

  it("calcula custo de entrega, margem e atraso por área com o custo por hora de cada área", () => {
    const data = computeIcp(
      baseInput({
        revenue: [
          pay("Grupo Alfa", "Insolvência", 100_000),
          pay("Grupo Alfa", "Trabalhista", 20_000),
          pay("Grupo Beta", "Tributário", 30_000),
        ],
        personnelCost: [
          { departamento: "Insolvência", valor: 60_000 },
          { departamento: "Trabalhista", valor: 10_000 },
          { departamento: "Facilities", valor: 99_000 },
        ],
        hours: [
          { grupo: "Grupo Alfa", area: "Cível | Insolvência", horas: 400 },
          { grupo: "Grupo Área Insolvência", area: "Insolvência", horas: 200 },
          { grupo: "Grupo Alfa", area: "Trabalhista", horas: 100 },
          { grupo: "Grupo Alfa", area: "Trabalhista", horas: 100 },
          { grupo: "Grupo Beta", area: "Tributário", horas: 50 },
        ],
        overdue: [
          { grupo: "Grupo Alfa", departamento: "Insolvência", valor: 7_000 },
          { grupo: "Grupo Alfa", departamento: "Financeiro", valor: 1_000 },
        ],
      })
    );

    // Insolvência: 60 mil ÷ 600 h = R$ 100/h; Trabalhista: 10 mil ÷ 200 h = R$ 50/h.
    const rate = (area: string) => data.delivery.rates.find((r) => r.area === area);
    expect(rate("Insolvência")).toMatchObject({ rate: 100, fallback: false });
    expect(rate("Trabalhista")).toMatchObject({ rate: 50, fallback: false });
    // Tributário não tem custo próprio: usa a média (70 mil ÷ 800 h).
    expect(rate("Tributário")).toMatchObject({ rate: 87.5, fallback: true });
    expect(data.delivery.personnelCost).toBe(70_000);
    expect(data.delivery.hours).toBe(850);
    expect(data.delivery.clientHours).toBe(650);

    const alfa = data.groups.find((g) => g.grupo === "Grupo Alfa")!;
    expect(alfa.hours12m).toBe(600);
    expect(alfa.deliveryCost).toBe(50_000);
    expect(alfa.overdue).toBe(8_000);
    expect(alfa.areas).toEqual(["Insolvência", "Trabalhista"]);
    expect(alfa.byArea["Insolvência"]).toEqual({ revenue: 100_000, hours: 400, cost: 40_000, overdue: 7_000 });
    expect(alfa.byArea["Outros"]).toEqual({ revenue: 0, hours: 0, cost: 0, overdue: 1_000 });
  });

  it("marca grupos só de pessoa física e ignora lançamentos de centavos", () => {
    const data = computeIcp(
      baseInput({
        revenue: [pay("Grupo Física", "Cível", 5_000), pay("Grupo Empresa", "Cível", 5_000), pay("Grupo Centavos", "Cível", 0.01)],
        pessoas: [
          { grupo: "Grupo Física", tipo: "PESSOA FÍSICA", uf: "SP", cidade: "Campinas", categoria: "Cliente ativo" },
          { grupo: "Grupo Empresa", tipo: "PESSOA JURÍDICA", uf: "SP", cidade: "Campinas", categoria: "Cliente ativo" },
        ],
      })
    );
    const byName = new Map(data.groups.map((g) => [g.grupo, g]));
    expect(byName.get("Grupo Física")?.clientType).toBe("pessoa_fisica");
    expect(byName.get("Grupo Empresa")?.clientType).toBe("pessoa_juridica");
    expect(byName.has("Grupo Centavos")).toBe(false);
  });
});

describe("sizeBuckets", () => {
  const group = (grupo: string, revenue: number, area = "Cível") =>
    computeIcp(baseInput({ revenue: [pay(grupo, area, revenue)] })).groups[0];

  it("separa 10 maiores, 10 em volta da mediana e 10 menores sem repetir grupos", () => {
    const groups = Array.from({ length: 41 }, (_, i) => group(`G${i + 1}`, (41 - i) * 1_000));
    const [top, middle, bottom] = sizeBuckets(groups, null);
    expect(top.groups.map((g) => g.grupo)).toEqual(groups.slice(0, 10).map((g) => g.grupo));
    expect(bottom.groups.map((g) => g.grupo)).toEqual(groups.slice(31).map((g) => g.grupo));
    // Mediana = G21 (posição 20); os médios vão de G16 a G25.
    expect(middle.groups.map((g) => g.grupo)).toEqual(groups.slice(15, 25).map((g) => g.grupo));
    expect(top.revenue).toBe(groups.slice(0, 10).reduce((acc, g) => acc + g.revenue12m, 0));
    expect([top.rankFrom, top.rankTo]).toEqual([1, 10]);
    expect([middle.rankFrom, middle.rankTo]).toEqual([16, 25]);
    expect([bottom.rankFrom, bottom.rankTo]).toEqual([32, 41]);
    expect(middle.rankedTotal).toBe(41);
    expect(middle.medianRevenue).toBe(21_000);
  });

  it("filtra pela área e não repete grupos quando há poucos pagantes", () => {
    const groups = [group("A", 50_000), group("B", 40_000, "Trabalhista"), group("C", 30_000), group("D", 20_000)];
    const [top, middle, bottom] = sizeBuckets(groups, "Cível", 2);
    expect(top.groups.map((g) => g.grupo)).toEqual(["A", "C"]);
    expect(middle.groups).toEqual([]);
    expect(bottom.groups.map((g) => g.grupo)).toEqual(["D"]);
  });
});
