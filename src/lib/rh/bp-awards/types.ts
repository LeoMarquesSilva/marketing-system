/**
 * Bismarchi | Pires Awards (Pessoas e Cultura > BP Awards).
 *
 * Premiação CIVIL da festa de 10 anos, separada em três hubs: cada
 * colaborador ativo indica, com login, quem do seu hub mais representa cada
 * valor e descreve uma situação concreta.
 * O comitê (quem tem RH) escolhe finalistas e vencedores; a revelação é no
 * telão da festa e o resultado só aparece para todos depois de publicado.
 */

export const AWARD_CATEGORY_KEYS = ["cliente", "inovacao", "valorizacao", "inteligencia", "liberdade"] as const;
export type AwardCategoryKey = (typeof AWARD_CATEGORY_KEYS)[number];

export interface AwardCategory {
  key: AwardCategoryKey;
  /** Letra do CIVIL. */
  letter: string;
  name: string;
  /**
   * O que a pessoa demonstra nesse valor, com as palavras definidas pelo RH em
   * 13/11/2026 (aparece na votação e no telão). Não reescrever.
   */
  description: string;
}

export const AWARD_CATEGORIES: AwardCategory[] = [
  {
    key: "cliente",
    letter: "C",
    name: "Cliente no Centro",
    description:
      "Demonstra interesse genuíno em conhecer o cliente a fundo, compreendendo suas particularidades e necessidades. Atua com escuta ativa e entrega soluções personalizadas, eficientes e relevantes. Constrói relacionamentos de longo prazo com empatia, presença e consistência.",
  },
  {
    key: "inovacao",
    letter: "I",
    name: "Inovação Constante",
    description:
      "Age com curiosidade e inquietude positiva, buscando constantemente novas formas de fazer melhor. Acompanha tendências, propõe melhorias e aplica tecnologia e inteligência operacional para transformar desafios em oportunidades. Mantém atuação moderna e estratégica.",
  },
  {
    key: "valorizacao",
    letter: "V",
    name: "Valorização das Pessoas",
    description:
      "Trata colegas, clientes e parceiros com respeito, empatia e equidade. Valoriza a diversidade e promove um ambiente colaborativo e inclusivo. Estimula o crescimento dos outros e constrói relações saudáveis e de confiança.",
  },
  {
    key: "inteligencia",
    letter: "I",
    name: "Inteligência em Resultados",
    description:
      "Entrega com excelência e agilidade, buscando não apenas cumprir metas, mas gerar soluções inteligentes e eficazes. Mantém foco em qualidade, consistência e impacto real para o cliente e para o negócio.",
  },
  {
    key: "liberdade",
    letter: "L",
    name: "Liberdade para Criar",
    description:
      "Demonstra autonomia e proatividade para propor ideias novas e soluções criativas. Sente-se à vontade para desafiar o status quo com responsabilidade e método. Atua com coragem e visão integrada, contribuindo para o crescimento coletivo.",
  },
];

export function awardCategory(key: string): AwardCategory | null {
  return AWARD_CATEGORIES.find((category) => category.key === key) ?? null;
}

export function isAwardCategoryKey(value: unknown): value is AwardCategoryKey {
  return typeof value === "string" && (AWARD_CATEGORY_KEYS as readonly string[]).includes(value);
}

/** Situação concreta: abaixo disso a indicação fica como rascunho. */
export const JUSTIFICATION_MIN = 20;
export const JUSTIFICATION_MAX = 4000;
export const CITATION_MAX = 1200;
/** Finalistas por valor (os mais indicados seguem para o comitê). */
export const MAX_FINALISTS = 3;

export const AWARDS_VOTING_PATH = "/bp-awards";
export const AWARDS_COMMITTEE_PATH = "/rh/bp-awards";
export const AWARDS_REVEAL_PATH = "/rh/bp-awards/revelacao";

/**
 * rascunho: sem datas · agendada: abre no futuro · aberta: recebendo indicações ·
 * apuracao: encerrada, comitê decidindo · publicada: resultado visível para todos.
 */
export type AwardPhase = "rascunho" | "agendada" | "aberta" | "apuracao" | "publicada";

export interface AwardEdition {
  id: string;
  year: number;
  title: string;
  voting_opens_at: string | null;
  voting_closes_at: string | null;
  partners_eligible: boolean;
  results_published_at: string | null;
  /** De qual hub é cada área; o RH ajusta em Configurações. */
  area_hubs: AreaHubs;
}

export function resolveAwardPhase(
  edition: Pick<AwardEdition, "voting_opens_at" | "voting_closes_at" | "results_published_at">,
  now: Date = new Date()
): AwardPhase {
  if (edition.results_published_at) return "publicada";
  if (!edition.voting_opens_at || !edition.voting_closes_at) return "rascunho";
  const time = now.getTime();
  if (time < new Date(edition.voting_opens_at).getTime()) return "agendada";
  if (time < new Date(edition.voting_closes_at).getTime()) return "aberta";
  return "apuracao";
}

export const AWARD_PHASE_LABEL: Record<AwardPhase, string> = {
  rascunho: "Sem datas",
  agendada: "Agendada",
  aberta: "Votação aberta",
  apuracao: "Em apuração",
  publicada: "Resultado publicado",
};

/* ------------------------------------------------------------------- hubs */

/**
 * Cada hub tem as suas 5 premiações e o colaborador só indica colegas do
 * próprio hub. Sócios patrimoniais (departamento "Sócio") não estão em hub:
 * votam nos três e não concorrem. O RH ajusta tudo isso em Configurações:
 * a área de cada hub e as exceções por pessoa.
 */
export const AWARD_HUB_KEYS = ["empresarial", "reestruturacao", "operacoes"] as const;
export type AwardHubKey = (typeof AWARD_HUB_KEYS)[number];

export interface AwardHub {
  key: AwardHubKey;
  name: string;
  /** Nome sem o "Hub", para botões e abas. */
  shortName: string;
  /** Áreas (hr_employees.department) que formam o hub por padrão. */
  departments: string[];
}

export const AWARD_HUBS: AwardHub[] = [
  {
    key: "empresarial",
    name: "Hub Empresarial",
    shortName: "Empresarial",
    departments: ["Cível", "Trabalhista", "Contratos", "Recuperação de Crédito", "Tributário"],
  },
  { key: "reestruturacao", name: "Hub Reestruturação", shortName: "Reestruturação", departments: ["Reestruturação"] },
  { key: "operacoes", name: "Hub Operações Legais", shortName: "Operações Legais", departments: ["Operações Legais"] },
];

export function awardHub(key: AwardHubKey): AwardHub {
  return AWARD_HUBS.find((hub) => hub.key === key)!;
}

export function isAwardHubKey(value: unknown): value is AwardHubKey {
  return typeof value === "string" && (AWARD_HUB_KEYS as readonly string[]).includes(value);
}

function normalizeArea(value: string | null): string {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Área → hub. */
export type AreaHubs = Record<string, AwardHubKey>;

export const DEFAULT_AREA_HUBS: AreaHubs = Object.fromEntries(
  AWARD_HUBS.flatMap((hub) => hub.departments.map((department) => [department, hub.key]))
);

/** Hub da área do colaborador (null = área fora dos hubs, como os sócios patrimoniais). */
export function hubOfDepartment(department: string | null, areaHubs: AreaHubs = DEFAULT_AREA_HUBS): AwardHubKey | null {
  const area = normalizeArea(department);
  if (!area) return null;
  for (const [key, hub] of Object.entries(areaHubs)) {
    if (normalizeArea(key) === area) return hub;
  }
  return null;
}

/** Áreas de cada hub, para mostrar nas telas. */
export function hubAreas(areaHubs: AreaHubs): Record<AwardHubKey, string[]> {
  const result = Object.fromEntries(AWARD_HUB_KEYS.map((hub) => [hub, [] as string[]])) as Record<AwardHubKey, string[]>;
  for (const [area, hub] of Object.entries(areaHubs)) result[hub]?.push(area);
  for (const hub of AWARD_HUB_KEYS) result[hub].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return result;
}

/** Sócio patrimonial: departamento "Sócio". */
export function isEquityPartner(person: { department: string | null }): boolean {
  return normalizeArea(person.department) === "socio";
}

/** Sócio patrimonial (departamento "Sócio") ou sócio de área (cargo). */
export function isPartner(person: { department: string | null; position: string | null }): boolean {
  if (isEquityPartner(person)) return true;
  return /^s[óo]ci[oa]\b/i.test((person.position ?? "").trim());
}

/** Exceção por pessoa, definida em Configurações: substitui a regra da área. */
export interface ParticipantOverride {
  employee_id: string;
  hub: AwardHubKey | null;
  vote_hubs: AwardHubKey[];
  can_compete: boolean;
}

export interface AwardRules {
  areaHubs: AreaHubs;
  partnersEligible: boolean;
  overrides: Map<string, ParticipantOverride>;
}

export function buildAwardRules(
  edition: Pick<AwardEdition, "area_hubs" | "partners_eligible">,
  overrides: ParticipantOverride[]
): AwardRules {
  return {
    areaHubs: edition.area_hubs ?? {},
    partnersEligible: edition.partners_eligible,
    overrides: new Map(overrides.map((override) => [override.employee_id, override])),
  };
}

export interface ResolvedParticipant {
  /** Hub a que pertence (onde pode ser indicado); null = fora dos hubs. */
  hub: AwardHubKey | null;
  /** Hubs em que indica; vazio = não vota. */
  voteHubs: AwardHubKey[];
  canCompete: boolean;
  /** A pessoa tem exceção própria em vez da regra da área. */
  adjusted: boolean;
}

type ParticipantPerson = { id: string; department: string | null; position: string | null };

/** O que vale para a pessoa sem exceção: a regra da área. */
export function defaultParticipant(person: ParticipantPerson, rules: AwardRules): ResolvedParticipant {
  const hub = hubOfDepartment(person.department, rules.areaHubs);
  const equity = isEquityPartner(person);
  return {
    hub,
    voteHubs: equity ? [...AWARD_HUB_KEYS] : hub ? [hub] : [],
    canCompete: hub !== null && !equity && (rules.partnersEligible || !isPartner(person)),
    adjusted: false,
  };
}

export function resolveParticipant(person: ParticipantPerson, rules: AwardRules): ResolvedParticipant {
  const override = rules.overrides.get(person.id);
  if (!override) return defaultParticipant(person, rules);
  return {
    hub: override.hub,
    voteHubs: AWARD_HUB_KEYS.filter((hub) => override.vote_hubs.includes(hub)),
    canCompete: override.hub !== null && override.can_compete,
    adjusted: true,
  };
}

/** Colaborador do cadastro como aparece nas telas do BP Awards. */
export interface AwardPerson {
  id: string;
  full_name: string;
  /** Nome de exibição: o do organograma, senão primeiro + último nome. */
  short_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  /** Hub da área; null para quem está fora dos hubs. */
  hub: AwardHubKey | null;
}

export interface AwardNominationDraft {
  hub: AwardHubKey;
  category: AwardCategoryKey;
  nominee_employee_id: string;
  justification: string;
}

/** Chave de uma indicação na cédula: um valor dentro de um hub. */
export function slotKey(hub: AwardHubKey, category: AwardCategoryKey): string {
  return `${hub}:${category}`;
}

export function isNominationComplete(nomination: Pick<AwardNominationDraft, "justification"> | undefined): boolean {
  return Boolean(nomination && nomination.justification.trim().length >= JUSTIFICATION_MIN);
}

export type VoterView =
  | { state: "no_edition" }
  | {
      state: "ready";
      edition: AwardEdition;
      phase: AwardPhase;
      /** Pré-visualização do RH: votação simulada aberta, nada é salvo. */
      preview: boolean;
      /** false = usuário sem cadastro de colaborador ativo em algum hub (não vota). */
      eligible: boolean;
      voterFirstName: string;
      /** Hubs em que indica: o da área, os três para sócio patrimonial, ou a exceção definida pelo RH. */
      hubs: AwardHubKey[];
      /** Áreas de cada hub nesta edição. */
      hubAreas: Record<AwardHubKey, string[]>;
      /** Quem pode ser indicado nos hubs do votante (sem a própria pessoa e, se for o caso, sem sócios). */
      candidates: AwardPerson[];
      nominations: AwardNominationDraft[];
      submittedAt: string | null;
      /** Só depois de publicado. */
      winners: AwardWinner[];
    };

export interface AwardWinner {
  hub: AwardHubKey;
  category: AwardCategoryKey;
  person: AwardPerson;
  citation: string | null;
}

export interface AwardInviteStatus {
  /** Votação aberta e a pessoa ainda não enviou. */
  pending: boolean;
  closesAt: string | null;
  filled: number;
  /** Indicações esperadas: 5 por hub (15 para sócio patrimonial). */
  total: number;
}

/* ---------------------------------------------------------------- comitê */

export type ParticipationStatus = "enviou" | "rascunho" | "pendente";

export interface ParticipationRow {
  person: AwardPerson;
  /** Hubs em que a pessoa vota. */
  hubs: AwardHubKey[];
  status: ParticipationStatus;
  /** Indicações preenchidas no rascunho. */
  filled: number;
  /** Indicações esperadas (5 por hub). */
  total: number;
  submitted_at: string | null;
}

export interface NominationTestimony {
  id: string;
  justification: string;
  voter: AwardPerson | null;
  updated_at: string;
}

export interface NomineeTally {
  person: AwardPerson;
  /** Indicações de cédulas enviadas. */
  count: number;
  testimonies: NominationTestimony[];
}

export type HubTallies = Record<AwardHubKey, Record<AwardCategoryKey, NomineeTally[]>>;

export interface AwardFinalist {
  id: string;
  hub: AwardHubKey;
  category: AwardCategoryKey;
  employee_id: string;
  is_winner: boolean;
  citation: string | null;
}

export interface CommitteeView {
  edition: AwardEdition;
  phase: AwardPhase;
  participation: ParticipationRow[];
  tallies: HubTallies;
  finalists: AwardFinalist[];
  people: AwardPerson[];
  overrides: ParticipantOverride[];
}

/** Vencedores esperados: 5 valores em cada hub. */
export const TOTAL_AWARDS = AWARD_HUB_KEYS.length * AWARD_CATEGORY_KEYS.length;

export interface RevealCategory {
  category: AwardCategory;
  finalists: AwardPerson[];
  winner: AwardPerson | null;
  citation: string | null;
}

export interface RevealHub {
  hub: AwardHub;
  categories: RevealCategory[];
}

/* --------------------------------------------------------------- identidade */

/** Arquivos da identidade (extraídos de Bismarchi_Pires_Awards_V1.pdf). */
export const AWARDS_LOGO_SRC = "/bp-awards/logo-awards.webp";
/** Só a silhueta dourada da logo, para espaços pequenos. */
export const AWARDS_SYMBOL_SRC = "/bp-awards/simbolo-awards.webp";

/** Selo do valor: símbolo próprio com o "ponto de luz" do Bismarchi | Pires. */
export function awardSealSrc(key: AwardCategoryKey): string {
  return `/bp-awards/selo-${key}.webp`;
}
