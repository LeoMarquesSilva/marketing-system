/**
 * Cálculo do ICP (perfil de cliente ideal) a partir dos dados do VIOS/SIOE e
 * dos sinais de marketing do ORQESTRAI. Funções puras: o servidor busca as
 * linhas e este módulo agrega tudo que a tela mostra.
 */

export interface IcpRevenueItem {
  grupo: string;
  departamento: string | null;
  planoContas: string | null;
  valor: number;
  dataPagamento: string;
}

export interface IcpProcessRow {
  grupo: string;
  area: string | null;
  dataCadastro: string | null;
}

export interface IcpPessoaRow {
  grupo: string;
  tipo: string | null;
  uf: string | null;
  cidade: string | null;
  categoria: string | null;
}

export interface IcpOverdueRow {
  grupo: string;
  valorEmAtraso: number;
}

export interface IcpSectorRow {
  grupo: string;
  setor: string | null;
  colaboradores: string | null;
}

export interface IcpNpsRow {
  cargo: string | null;
  recommend: number | null;
}

export interface IcpNpsTheme {
  id: string;
  polarity: "strength" | "pain" | string;
}

export interface IcpDemographicRow {
  reportType: string;
  dimension: string;
  label: string;
  value: number;
}

export interface IcpCitySessions {
  city: string;
  sessions: number;
}

export interface IcpWhatsappLead {
  leadSource: string | null;
  pipelineStage: string | null;
}

export interface IcpInput {
  now: Date;
  revenue: IcpRevenueItem[];
  processes: IcpProcessRow[];
  pessoas: IcpPessoaRow[];
  overdue: IcpOverdueRow[];
  sectors: IcpSectorRow[];
  nps: IcpNpsRow[];
  npsThemes: IcpNpsTheme[];
  linkedin: IcpDemographicRow[];
  ga4Cities: IcpCitySessions[];
  whatsapp: IcpWhatsappLead[];
}

export type IcpTierKey = "A" | "B" | "C" | "D";

export interface IcpTier {
  key: IcpTierKey;
  label: string;
  range: string;
  groups: number;
  groupShare: number;
  revenue: number;
  revenueShare: number;
  avgMonthly: number;
  avgAreas: number;
  retainerShare: number;
  overdueRatio: number;
}

export interface IcpGroupRow {
  grupo: string;
  tier: IcpTierKey;
  revenue12m: number;
  monthly: number;
  hasRetainer: boolean;
  areas: string[];
  entryArea: string | null;
  firstProcess: string | null;
  activeSince2025: boolean;
  sector: string | null;
  sectorBucket: string | null;
  sizeBucket: string | null;
  city: string | null;
  uf: string | null;
  hasLegalEntity: boolean;
  overdue: number;
}

export interface IcpCount {
  label: string;
  count: number;
}

export interface IcpShare {
  label: string;
  value: number;
  share: number;
}

export interface IcpData {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  totals: {
    revenue12m: number;
    payingGroups: number;
    groupsFor50: number;
    groupsFor80: number;
    coreGroups: number;
    coreRevenueShare: number;
    breadthMultiplier: number | null;
  };
  tiers: IcpTier[];
  areaRevenue: IcpShare[];
  breadth: { label: string; groups: number; median: number }[];
  entry: { core: IcpCount[]; rest: IcpCount[]; coreViaInsolvency: number };
  newCore: { total: number; viaInsolvency: number };
  sectors: { core: IcpShare[]; coverageShare: number; coreKnown: number };
  sizes: { core: IcpCount[]; coreKnown: number; core51plus: number };
  geography: {
    spShare: number;
    ufShares: IcpShare[];
    coreInterior: number;
    coreCapital: number;
    coreOtherUf: number;
    coreUnknown: number;
    topCities: IcpShare[];
  };
  legalEntityShare: { core: number; rest: number };
  retainer: { core: number; rest: number; revenueShare: number };
  decisor: {
    responses: number;
    nps: number | null;
    ownerResponses: number;
    ownerAvg: number | null;
    financeOrDirector: number;
    byRole: IcpCount[];
    strengths: IcpCount[];
    pains: IcpCount[];
  };
  marketing: {
    linkedinFollowers: number;
    linkedinLegalShare: number | null;
    linkedinIndustryShare: number | null;
    linkedinDecisionShare: number | null;
    ga4TopCities: IcpCitySessions[];
    whatsappTotal: number;
    whatsappBySource: IcpCount[];
    whatsappUnqualified: number;
  };
  groups: IcpGroupRow[];
}

/** Áreas de prática (os demais departamentos de receita entram como "Outros"). */
const PRACTICE_AREAS = [
  "Insolvência",
  "Cível",
  "Trabalhista",
  "Contratos",
  "Distressed Deals",
  "Recuperação de Crédito",
  "Tributário",
  "Operações Legais",
] as const;

export const CORE_MIN_REVENUE = 60_000;

const TIER_DEFS: { key: IcpTierKey; label: string; range: string; min: number; max: number }[] = [
  { key: "A", label: "Faixa A", range: "R$ 200 mil+", min: 200_000, max: Infinity },
  { key: "B", label: "Faixa B", range: "R$ 60 a 200 mil", min: CORE_MIN_REVENUE, max: 200_000 },
  { key: "C", label: "Faixa C", range: "R$ 20 a 60 mil", min: 20_000, max: CORE_MIN_REVENUE },
  { key: "D", label: "Faixa D", range: "até R$ 20 mil", min: 0, max: 20_000 },
];

const ROLE_TOKENS: { label: string; test: RegExp }[] = [
  { label: "Sócio ou proprietário", test: /s[óo]ci|propriet|dono/i },
  { label: "Diretoria", test: /diretor|ceo|presidente/i },
  { label: "Financeiro", test: /financ/i },
  { label: "Jurídico ou compliance", test: /jur[íi]d|compliance/i },
  { label: "RH", test: /recursos humanos|\brh\b/i },
];

const THEME_LABELS: Record<string, string> = {
  relacionamento: "Relacionamento",
  tecnica: "Competência técnica",
  agilidade: "Agilidade",
  organizacao: "Organização",
  disponibilidade: "Disponibilidade",
  comunicacao: "Comunicação",
  inovacao: "Inovação",
  engajamento_socio: "Presença dos sócios",
  outro: "Outros",
};

export function normalizePracticeArea(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (/insolv/i.test(value)) return "Insolvência";
  if (/special situations|distressed/i.test(value)) return "Distressed Deals";
  const match = PRACTICE_AREAS.find((a) => a.toLowerCase() === value.toLowerCase());
  return match ?? null;
}

/** Agrupa o setor livre do CRM em macrossetores comparáveis. */
export function sectorBucket(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (!s || /jur[íi]dic|reclamante|^n\/a$|^-$|bismarchi|https?:/.test(s)) return null;
  if (
    /fabrica|ind[uú]stria|embalage|perfis|fios|tecelagem|metal|sider|ferrament|estamparia|tinta|pap[ée]is|equipamento|charque|frigor|m[áa]quina|pl[áa]stic|t[êe]xt|pvc|aditivo|eletr[ôo]nic|blindagem|decora|aliment|sucos|confeit|bebida/.test(
      s
    )
  )
    return "Indústria";
  if (/fundo|securitiz|factoring|banco|cr[ée]dit|pagamento|seguro|investimento/.test(s))
    return "Financeiro e crédito";
  if (/com[ée]rcio|varejista|representantes/.test(s)) return "Comércio e distribuição";
  if (/transport|log[íi]st|aduaneiro/.test(s)) return "Logística e comex";
  if (/constru|engenharia|imobili|impermeab/.test(s)) return "Construção e imobiliário";
  if (/hospital|m[ée]dic|odonto|sa[úu]de/.test(s)) return "Saúde";
  if (/restaurante|hotel|evento|danceteria|educa/.test(s)) return "Serviços ao consumidor";
  return "Serviços B2B";
}

/** Converte a faixa de colaboradores do CRM em quatro portes. */
export function sizeBucket(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("mais de")) return "200+";
  const first = Number.parseInt(s.replace(/[^\d].*$/, "").trim() || s.match(/\d+/)?.[0] || "", 10);
  if (!Number.isFinite(first)) return null;
  if (first < 11) return "1 a 10";
  if (first < 51) return "11 a 50";
  if (first < 201) return "51 a 200";
  return "200+";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function countBy<T>(items: T[], key: (item: T) => string | null): IcpCount[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function mode(values: (string | null)[]): string | null {
  const counts = countBy(values, (v) => v);
  return counts[0]?.label ?? null;
}

function cleanCity(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || /n[ãa]o informad/i.test(v)) return null;
  return v;
}

function isClientCategory(categoria: string | null): boolean {
  const c = (categoria ?? "").toLowerCase();
  if (!c) return true;
  return c.includes("cliente");
}

function isLegalEntityType(tipo: string | null): boolean {
  return /jur/i.test(tipo ?? "");
}

function windowStartFor(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function tierFor(revenue: number): IcpTierKey {
  return (TIER_DEFS.find((t) => revenue >= t.min && revenue < t.max)?.key ?? "D") as IcpTierKey;
}

export function computeIcp(input: IcpInput): IcpData {
  const windowStart = isoDate(windowStartFor(input.now));
  const windowEnd = isoDate(input.now);
  const inWindow = (d: string) => d >= windowStart && d <= windowEnd;

  // Receita por grupo nos últimos 12 meses.
  const byGroup = new Map<
    string,
    { revenue: number; retainer: number; areas: Map<string, number> }
  >();
  const areaTotals = new Map<string, number>();
  for (const item of input.revenue) {
    if (!item.grupo || item.valor <= 0 || !inWindow(item.dataPagamento)) continue;
    const entry = byGroup.get(item.grupo) ?? { revenue: 0, retainer: 0, areas: new Map() };
    entry.revenue += item.valor;
    if (/mensa/i.test(item.planoContas ?? "")) entry.retainer += item.valor;
    const area = normalizePracticeArea(item.departamento) ?? "Outros";
    if (area !== "Outros") entry.areas.set(area, (entry.areas.get(area) ?? 0) + item.valor);
    areaTotals.set(area, (areaTotals.get(area) ?? 0) + item.valor);
    byGroup.set(item.grupo, entry);
  }

  // Primeiro processo do grupo = porta de entrada.
  const firstProcess = new Map<string, { area: string | null; date: string }>();
  for (const p of input.processes) {
    if (!p.grupo || !p.dataCadastro) continue;
    const current = firstProcess.get(p.grupo);
    if (!current || p.dataCadastro < current.date) {
      firstProcess.set(p.grupo, { area: p.area, date: p.dataCadastro });
    }
  }

  const pessoasByGroup = new Map<string, IcpPessoaRow[]>();
  for (const p of input.pessoas) {
    if (!p.grupo || !isClientCategory(p.categoria)) continue;
    const list = pessoasByGroup.get(p.grupo) ?? [];
    list.push(p);
    pessoasByGroup.set(p.grupo, list);
  }

  const overdueByGroup = new Map(input.overdue.map((o) => [o.grupo, o.valorEmAtraso]));
  const sectorByGroup = new Map<string, IcpSectorRow>();
  for (const s of input.sectors) {
    const key = s.grupo.trim().toLowerCase();
    const prev = sectorByGroup.get(key);
    sectorByGroup.set(key, {
      grupo: s.grupo,
      setor: prev?.setor ?? s.setor,
      colaboradores: prev?.colaboradores ?? s.colaboradores,
    });
  }

  const groups: IcpGroupRow[] = [...byGroup.entries()]
    .map(([grupo, g]) => {
      const pessoas = pessoasByGroup.get(grupo) ?? [];
      const sector = sectorByGroup.get(grupo.trim().toLowerCase());
      const first = firstProcess.get(grupo);
      const sectorLabel = sector?.setor ?? null;
      const bucket = sectorBucket(sectorLabel);
      return {
        grupo,
        tier: tierFor(g.revenue),
        revenue12m: g.revenue,
        monthly: g.revenue / 12,
        hasRetainer: g.retainer > 0,
        areas: [...g.areas.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a),
        entryArea: first?.area ?? null,
        firstProcess: first?.date ?? null,
        activeSince2025: Boolean(first?.date && first.date >= "2025-01-01"),
        sector: bucket ? sectorLabel : null,
        sectorBucket: bucket,
        sizeBucket: sizeBucket(sector?.colaboradores),
        city: mode(pessoas.map((p) => cleanCity(p.cidade))),
        uf: mode(pessoas.map((p) => (p.uf ?? "").trim().toUpperCase() || null)),
        hasLegalEntity: pessoas.some((p) => isLegalEntityType(p.tipo)),
        overdue: overdueByGroup.get(grupo) ?? 0,
      } satisfies IcpGroupRow;
    })
    .sort((a, b) => b.revenue12m - a.revenue12m);

  const total = groups.reduce((acc, g) => acc + g.revenue12m, 0);
  const share = (v: number, base = total) => (base > 0 ? v / base : 0);

  let running = 0;
  let groupsFor50 = 0;
  let groupsFor80 = 0;
  groups.forEach((g, i) => {
    running += g.revenue12m;
    if (!groupsFor50 && running >= total * 0.5) groupsFor50 = i + 1;
    if (!groupsFor80 && running >= total * 0.8) groupsFor80 = i + 1;
  });

  const tiers: IcpTier[] = TIER_DEFS.map((def) => {
    const list = groups.filter((g) => g.tier === def.key);
    const revenue = list.reduce((acc, g) => acc + g.revenue12m, 0);
    const overdue = list.reduce((acc, g) => acc + g.overdue, 0);
    return {
      key: def.key,
      label: def.label,
      range: def.range,
      groups: list.length,
      groupShare: share(list.length, groups.length),
      revenue,
      revenueShare: share(revenue),
      avgMonthly: list.length ? revenue / list.length / 12 : 0,
      avgAreas: list.length ? list.reduce((acc, g) => acc + g.areas.length, 0) / list.length : 0,
      retainerShare: list.length ? list.filter((g) => g.hasRetainer).length / list.length : 0,
      overdueRatio: revenue > 0 ? overdue / revenue : 0,
    };
  });

  const core = groups.filter((g) => g.tier === "A" || g.tier === "B");
  const rest = groups.filter((g) => g.tier === "C" || g.tier === "D");
  const coreRevenue = core.reduce((acc, g) => acc + g.revenue12m, 0);

  const areaRevenue: IcpShare[] = [...areaTotals.entries()]
    .map(([label, value]) => ({ label, value, share: share(value) }))
    .sort((a, b) => (a.label === "Outros" ? 1 : b.label === "Outros" ? -1 : b.value - a.value));

  const breadthBuckets: { label: string; test: (n: number) => boolean }[] = [
    { label: "1 área", test: (n) => n <= 1 },
    { label: "2 áreas", test: (n) => n === 2 },
    { label: "3 ou mais", test: (n) => n >= 3 },
  ];
  const breadth = breadthBuckets.map((b) => {
    const list = groups.filter((g) => b.test(g.areas.length));
    return { label: b.label, groups: list.length, median: median(list.map((g) => g.revenue12m)) };
  });
  const breadthMultiplier =
    breadth[0].median > 0 ? breadth[2].median / breadth[0].median : null;

  const entryLabel = (g: IcpGroupRow) => {
    if (!g.entryArea) return null;
    return /insolv/i.test(g.entryArea) ? "Insolvência" : normalizePracticeArea(g.entryArea) ?? g.entryArea;
  };
  const coreEntry = countBy(core, entryLabel);
  const newCoreList = core.filter((g) => g.activeSince2025);

  const coreWithSector = core.filter((g) => g.sectorBucket);
  const coreSectorRevenue = coreWithSector.reduce((acc, g) => acc + g.revenue12m, 0);
  const sectorMap = new Map<string, number>();
  for (const g of coreWithSector) {
    sectorMap.set(g.sectorBucket!, (sectorMap.get(g.sectorBucket!) ?? 0) + g.revenue12m);
  }
  const allWithSector = groups.filter((g) => g.sectorBucket);

  const coreSizes = countBy(core, (g) => g.sizeBucket);
  const ufMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  for (const g of groups) {
    const uf = g.uf ?? "Sem UF";
    ufMap.set(uf, (ufMap.get(uf) ?? 0) + g.revenue12m);
    if (g.city) cityMap.set(g.city, (cityMap.get(g.city) ?? 0) + g.revenue12m);
  }
  const isCapital = (g: IcpGroupRow) => /^s[ãa]o paulo$/i.test(g.city ?? "");

  // NPS e decisor.
  const npsScores = input.nps.filter((r) => typeof r.recommend === "number") as {
    cargo: string | null;
    recommend: number;
  }[];
  const promoters = npsScores.filter((r) => r.recommend >= 9).length;
  const detractors = npsScores.filter((r) => r.recommend <= 6).length;
  const roleOf = (cargo: string | null) =>
    ROLE_TOKENS.find((r) => r.test.test(cargo ?? ""))?.label ?? (cargo ? "Outros cargos" : "Não informado");
  const owners = npsScores.filter((r) => roleOf(r.cargo) === "Sócio ou proprietário");
  const themeCount = (polarity: string) =>
    countBy(
      input.npsThemes.filter((t) => t.polarity === polarity),
      (t) => THEME_LABELS[t.id] ?? t.id
    );

  // Marketing.
  const liFollowers = input.linkedin.filter((r) => r.reportType === "followers");
  const sumWhere = (rows: IcpDemographicRow[], dimension: string, test?: RegExp) =>
    rows
      .filter((r) => r.dimension === dimension && (!test || test.test(r.label)))
      .reduce((acc, r) => acc + r.value, 0);
  const industryTotal = sumWhere(liFollowers, "industry");
  const seniorityTotal = sumWhere(liFollowers, "seniority");
  const ratio = (v: number, base: number) => (base > 0 ? v / base : null);

  const whatsappSources = countBy(input.whatsapp, (w) => {
    if (w.leadSource === "meta_ads") return "Meta Ads";
    if (w.leadSource === "site_whatsapp") return "Botão do site";
    return "Sem origem";
  });

  return {
    generatedAt: input.now.toISOString(),
    windowStart,
    windowEnd,
    totals: {
      revenue12m: total,
      payingGroups: groups.length,
      groupsFor50,
      groupsFor80,
      coreGroups: core.length,
      coreRevenueShare: share(coreRevenue),
      breadthMultiplier,
    },
    tiers,
    areaRevenue,
    breadth,
    entry: {
      core: coreEntry,
      rest: countBy(rest, entryLabel),
      coreViaInsolvency: coreEntry.find((e) => e.label === "Insolvência")?.count ?? 0,
    },
    newCore: {
      total: newCoreList.length,
      viaInsolvency: newCoreList.filter((g) => /insolv/i.test(g.entryArea ?? "")).length,
    },
    sectors: {
      core: [...sectorMap.entries()]
        .map(([label, value]) => ({ label, value, share: share(value, coreSectorRevenue) }))
        .sort((a, b) => b.value - a.value),
      coverageShare: share(allWithSector.reduce((acc, g) => acc + g.revenue12m, 0)),
      coreKnown: coreWithSector.length,
    },
    sizes: {
      core: ["1 a 10", "11 a 50", "51 a 200", "200+"].map((label) => ({
        label,
        count: coreSizes.find((s) => s.label === label)?.count ?? 0,
      })),
      coreKnown: coreSizes.reduce((acc, s) => acc + s.count, 0),
      core51plus: core.filter((g) => g.sizeBucket === "51 a 200" || g.sizeBucket === "200+").length,
    },
    geography: {
      spShare: share(ufMap.get("SP") ?? 0),
      ufShares: [...ufMap.entries()]
        .map(([label, value]) => ({ label, value, share: share(value) }))
        .sort((a, b) => b.value - a.value),
      coreInterior: core.filter((g) => g.uf === "SP" && g.city && !isCapital(g)).length,
      coreCapital: core.filter((g) => g.uf === "SP" && isCapital(g)).length,
      coreOtherUf: core.filter((g) => g.uf && g.uf !== "SP").length,
      coreUnknown: core.filter((g) => !g.uf || (g.uf === "SP" && !g.city)).length,
      topCities: [...cityMap.entries()]
        .map(([label, value]) => ({ label, value, share: share(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    },
    legalEntityShare: {
      core: core.length ? core.filter((g) => g.hasLegalEntity).length / core.length : 0,
      rest: rest.length ? rest.filter((g) => g.hasLegalEntity).length / rest.length : 0,
    },
    retainer: {
      core: core.length ? core.filter((g) => g.hasRetainer).length / core.length : 0,
      rest: rest.length ? rest.filter((g) => g.hasRetainer).length / rest.length : 0,
      revenueShare: share(groups.filter((g) => g.hasRetainer).reduce((acc, g) => acc + g.revenue12m, 0)),
    },
    decisor: {
      responses: npsScores.length,
      nps: npsScores.length ? Math.round(((promoters - detractors) / npsScores.length) * 100) : null,
      ownerResponses: owners.length,
      ownerAvg: owners.length ? owners.reduce((acc, r) => acc + r.recommend, 0) / owners.length : null,
      financeOrDirector: npsScores.filter((r) => ["Diretoria", "Financeiro"].includes(roleOf(r.cargo))).length,
      byRole: countBy(npsScores, (r) => roleOf(r.cargo)),
      strengths: themeCount("strength"),
      pains: themeCount("pain"),
    },
    marketing: {
      linkedinFollowers: industryTotal,
      linkedinLegalShare: ratio(sumWhere(liFollowers, "industry", /jur[íi]d|advoc|justi/i), industryTotal),
      linkedinIndustryShare: ratio(
        sumWhere(liFollowers, "industry", /fabrica|ind[úu]stria|manufatura|metal|pl[áa]stic|t[êe]xt|aliment|m[áa]quin/i),
        industryTotal
      ),
      linkedinDecisionShare: ratio(
        sumWhere(liFollowers, "seniority", /dirigente|propriet|vice|diretor/i),
        seniorityTotal
      ),
      ga4TopCities: [...input.ga4Cities].sort((a, b) => b.sessions - a.sessions).slice(0, 6),
      whatsappTotal: input.whatsapp.length,
      whatsappBySource: whatsappSources,
      whatsappUnqualified: input.whatsapp.filter(
        (w) => !w.pipelineStage || w.pipelineStage === "lead_recebido"
      ).length,
    },
    groups,
  };
}
