/**
 * Boas-vindas de colaborador novo (Pessoas e Cultura › Dados cadastrais).
 * O RH conclui o onboarding: o sistema cria o acesso ao ORQESTRAI e manda um
 * e-mail curto com o botão de acesso. Os links da área e as explicações ficam
 * em /meus-links, onde a pessoa cai no primeiro acesso.
 */

/** Por quantos dias depois da conclusão Meus links abre com o texto de boas-vindas. */
export const WELCOME_INTRO_DAYS = 30;

/** Quem entra na fila de "Aguardando conclusão" (admitidos ou cadastrados a partir daqui). */
export const WELCOME_QUEUE_START = "2026-11-09";

/** Validade do link de primeiro acesso enviado no e-mail. */
export const WELCOME_SETUP_VALIDITY_DAYS = 7;

/** Vínculos aceitos em `hr_employees.employment_type` (mesma lista da ficha do colaborador). */
export const WELCOME_EMPLOYMENT_TYPES = [
  "CLT",
  "ESTAGIÁRIO",
  "SÓCIO DE SERVIÇO",
  "PRESTADOR",
  "ASSISTENTE",
  "SÓCIO COTISTA",
  "SÓCIO PATRIMONIAL",
] as const;

export interface WelcomeLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  /** Informação extra em Meus links (ex.: senha padrão). */
  internalNote: string | null;
  /** 'todos', chave de divisão ou de equipe do organograma. */
  audience: string;
  sortOrder: number;
  isActive: boolean;
}

export interface WelcomeLinkInput {
  id?: string;
  title: string;
  url: string;
  description: string | null;
  internalNote: string | null;
  audience: string;
  isActive: boolean;
}

/** Situação do login de quem está entrando. */
export type WelcomeLoginState = "sem_login" | "nunca_entrou" | "ja_entrou";

export interface WelcomeRecord {
  completedAt: string;
  completedByName: string | null;
  audienceKey: string | null;
  emailTo: string | null;
  emailSentAt: string | null;
  emailSendCount: number;
  lastSentByName: string | null;
  lastError: string | null;
}

export interface WelcomeEmployee {
  employeeId: string;
  fullName: string;
  /** E-mail do cadastro do RH, já no domínio @bismarchipires.com.br. */
  email: string | null;
  /** E-mail de login de quem já tem acesso ao ORQESTRAI (é o que o modal sugere). */
  loginEmail: string | null;
  avatarUrl: string | null;
  department: string | null;
  position: string | null;
  employmentType: string | null;
  admissionDate: string | null;
  /** Público sugerido pelo organograma (ou pela área do VIOS). */
  suggestedAudience: string | null;
  /** Já está numa equipe do organograma: é ela que define Meus links. */
  placedInOrgChart: boolean;
  loginState: WelcomeLoginState;
  lastSignInAt: string | null;
  /** Entrou depois de WELCOME_QUEUE_START: aparece em "Aguardando conclusão". */
  inQueue: boolean;
  record: WelcomeRecord | null;
}

export interface WelcomeOverview {
  links: WelcomeLink[];
  employees: WelcomeEmployee[];
}

export interface CompleteOnboardingInput {
  employeeId: string;
  email: string;
  audienceKey: string | null;
  /** Obrigatório quando a ficha está sem vínculo. */
  employmentType?: string | null;
}

/** Links que aparecem em Meus links, já agrupados. */
export interface MyWelcomeLinks {
  firstName: string | null;
  /** Onboarding concluído há pouco: a página abre com o texto de boas-vindas. */
  recentWelcome: boolean;
  groups: { key: string; label: string; links: WelcomeLink[] }[];
}
