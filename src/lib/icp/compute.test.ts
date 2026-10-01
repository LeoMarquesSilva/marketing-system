import { describe, expect, it } from "vitest";
import { computeIcp, normalizePracticeArea, sectorBucket, sizeBucket, type IcpInput } from "@/lib/icp/compute";

const NOW = new Date("2026-10-01T12:00:00Z");

function baseInput(overrides: Partial<IcpInput> = {}): IcpInput {
  return {
    now: NOW,
    revenue: [],
    processes: [],
    pessoas: [],
    overdue: [],
    sectors: [],
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

  it("agrupa setores livres do CRM", () => {
    expect(sectorBucket("Fabricação de embalagens de material plástico")).toBe("Indústria");
    expect(sectorBucket("Securitizadora")).toBe("Financeiro e crédito");
    expect(sectorBucket("TRANSPORTADORA")).toBe("Logística e comex");
    expect(sectorBucket("Serviços Jurídicos")).toBeNull();
    expect(sectorBucket("Reclamante")).toBeNull();
  });

  it("converte faixas de colaboradores em porte", () => {
    expect(sizeBucket("51 - 200")).toBe("51 a 200");
    expect(sizeBucket("201-1000")).toBe("200+");
    expect(sizeBucket("mais de 1000")).toBe("200+");
    expect(sizeBucket("6-10")).toBe("1 a 10");
    expect(sizeBucket("N/A")).toBeNull();
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
        sectors: [{ grupo: "grupo alfa", setor: "Fabricação de máquinas e equipamentos", colaboradores: "51-200" }],
      })
    );

    const alfa = data.groups[0];
    expect(alfa.entryArea).toBe("Cível | Insolvência");
    expect(alfa.activeSince2025).toBe(true);
    expect(alfa.city).toBe("Campinas");
    expect(alfa.hasLegalEntity).toBe(true);
    expect(alfa.sectorBucket).toBe("Indústria");
    expect(alfa.sizeBucket).toBe("51 a 200");
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
});
