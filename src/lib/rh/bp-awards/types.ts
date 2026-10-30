/**
 * Bismarchi | Pires Awards (Pessoas e Cultura > BP Awards).
 *
 * Premiação CIVIL da festa de 10 anos: cada colaborador ativo indica, com
 * login, quem mais representa cada valor e descreve uma situação concreta.
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
  /** Texto do valor, como na pesquisa aprovada pelo RH. */
  description: string;
}

export const AWARD_CATEGORIES: AwardCategory[] = [
  {
    key: "cliente",
    letter: "C",
    name: "Cliente no Centro",
    description:
      "Conhecemos nossos clientes a fundo, entendemos que cada um tem particularidades únicas e entregamos soluções personalizadas com presença, empatia e consistência.",
  },
  {
    key: "inovacao",
    letter: "I",
    name: "Inovação Constante",
    description:
      "Somos inquietos, tecnológicos e conectados ao futuro, antecipando tendências e buscando inteligência operacional para transformar desafios em oportunidades.",
  },
  {
    key: "valorizacao",
    letter: "V",
    name: "Valorização das Pessoas",
    description:
      "Nossa cultura é feita por pessoas e para pessoas: valorizamos a diversidade, promovemos um ambiente inclusivo e estimulamos o crescimento dos talentos.",
  },
  {
    key: "inteligencia",
    letter: "I",
    name: "Inteligência em Resultados",
    description:
      "Entregamos com excelência e rapidez, com soluções inteligentes que realmente fazem a diferença para nossos clientes, com agilidade, qualidade e consistência.",
  },
  {
    key: "liberdade",
    letter: "L",
    name: "Liberdade para Criar",
    description:
      "Acreditamos que o novo nasce do desafio, estimulando ideias ousadas e criativas com autonomia e segurança.",
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

/** Sócio patrimonial (departamento "Sócio") ou sócio de área (cargo). */
export function isPartner(person: { department: string | null; position: string | null }): boolean {
  if ((person.department ?? "").trim().toLowerCase() === "sócio") return true;
  return /^s[óo]ci[oa]\b/i.test((person.position ?? "").trim());
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
}

export interface AwardNominationDraft {
  category: AwardCategoryKey;
  nominee_employee_id: string;
  justification: string;
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
      /** false = usuário sem cadastro de colaborador ativo (não vota). */
      eligible: boolean;
      voterFirstName: string;
      /** Quem pode ser indicado (sem a própria pessoa e, se for o caso, sem sócios). */
      candidates: AwardPerson[];
      nominations: AwardNominationDraft[];
      submittedAt: string | null;
      /** Só depois de publicado. */
      winners: AwardWinner[];
    };

export interface AwardWinner {
  category: AwardCategoryKey;
  person: AwardPerson;
  citation: string | null;
}

export interface AwardInviteStatus {
  /** Votação aberta e a pessoa ainda não enviou. */
  pending: boolean;
  closesAt: string | null;
  filled: number;
}

/* ---------------------------------------------------------------- comitê */

export type ParticipationStatus = "enviou" | "rascunho" | "pendente";

export interface ParticipationRow {
  person: AwardPerson;
  status: ParticipationStatus;
  /** Valores preenchidos no rascunho (0–5). */
  filled: number;
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

export interface AwardFinalist {
  id: string;
  category: AwardCategoryKey;
  employee_id: string;
  is_winner: boolean;
  citation: string | null;
}

export interface CommitteeView {
  edition: AwardEdition;
  phase: AwardPhase;
  participation: ParticipationRow[];
  tallies: Record<AwardCategoryKey, NomineeTally[]>;
  finalists: AwardFinalist[];
  people: AwardPerson[];
}

export interface EditionUpdateInput {
  voting_opens_at?: string | null;
  voting_closes_at?: string | null;
  partners_eligible?: boolean;
  /** true publica o resultado agora; false volta a esconder. */
  publish?: boolean;
}

export interface RevealCategory {
  category: AwardCategory;
  finalists: AwardPerson[];
  winner: AwardPerson | null;
  citation: string | null;
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
