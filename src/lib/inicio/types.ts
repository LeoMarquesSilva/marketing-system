import type { WelcomeLink } from "@/lib/rh/welcome/types";

/** Pessoa da equipe como aparece na tela inicial (foto + nome curto). */
export interface HomePerson {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  avatarUrl: string | null;
}

export type HomePendingKind = "bp-awards" | "pesquisa" | "festa" | "ficha" | "reels" | "vistagem";

/** Algo que espera uma ação da própria pessoa. */
export interface HomePending {
  id: string;
  kind: HomePendingKind;
  title: string;
  detail: string | null;
  href: string;
  /** Prazo (ISO), quando existe. */
  deadline: string | null;
  count: number | null;
  /** Como o total se divide (ex.: publicações por fila da Vistagem). */
  breakdown?: Array<{ label: string; value: number }>;
}

/**
 * Uma comemoração da equipe como aparece na tela inicial: aniversário (sem o
 * ano de nascimento: a idade de ninguém vai para a tela) ou aniversário de empresa.
 */
export interface HomeCelebration extends HomePerson {
  kind: "aniversario" | "empresa";
  /** Ano em que a comemoração cai (a arte e as felicitações são por ano). */
  year: number;
  day: number;
  month: number;
  /** Dias até a data: 0 = hoje; negativo = já passou, ainda na semana de felicitações. */
  inDays: number;
  /** Anos de casa que completa (só no aniversário de empresa). */
  years: number | null;
  /** Arte que o Marketing subiu para este ano (link assinado). */
  artUrl: string | null;
  likes: number;
  /** Quem está logado já parabenizou. */
  liked: boolean;
  comments: number;
  /** Reconhecimentos de valor (CIVIL) recebidos. */
  praises: number;
}

export type HomeBirthday = HomeCelebration;
export type HomeWorkAnniversary = HomeCelebration & { years: number };

export interface HomeNewcomer extends HomePerson {
  /** Data de admissão (YYYY-MM-DD). */
  since: string;
}

export interface HomeDateRange {
  start: string;
  end: string;
  days: number;
}

export interface HomeData {
  /** Hoje em Brasília (YYYY-MM-DD). */
  today: string;
  me: {
    name: string;
    firstName: string;
    position: string | null;
    department: string | null;
    avatarUrl: string | null;
    /** Data de admissão do cadastro de Pessoas e Cultura; null quando a pessoa não tem ficha. */
    admissionDate: string | null;
    birthdayToday: boolean;
  };
  pending: HomePending[];
  /** Próximas férias ou licença da própria pessoa. */
  nextLeave: (HomeDateRange & { kind: string }) | null;
  /** Próximo recesso do escritório. */
  nextRecess: HomeDateRange | null;
  /** Festa de 10 anos, como está no cadastro de eventos. */
  party: { name: string; date: string; location: string | null } | null;
  /** Pessoas ativas no cadastro de Pessoas e Cultura. */
  teamSize: number | null;
  birthdays: HomeBirthday[];
  newcomers: HomeNewcomer[];
  /** Quem completa ano de casa nos próximos 30 dias. */
  workAnniversaries: HomeWorkAnniversary[];
  /** Quem comemorou nos últimos 7 dias (ainda dá para parabenizar). */
  recentCelebrations: HomeCelebration[];
  /** As comemorações de quem está logado, hoje ou na última semana: viram o aviso do topo. */
  myCelebrations: HomeCelebration[];
  /** Quem está logado pode subir as artes de aniversário (Marketing e admin). */
  canManageBirthdayArts: boolean;
  /** Ferramentas da área da pessoa (as mesmas de Meus links). */
  links: WelcomeLink[];
  /** Atalhos favoritos salvos na conta; null quando a pessoa nunca personalizou. */
  favorites: string[] | null;
}
