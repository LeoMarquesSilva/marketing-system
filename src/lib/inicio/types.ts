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
}

/** Aniversário sem o ano: a idade de ninguém vai para a tela. */
export interface HomeBirthday extends HomePerson {
  day: number;
  month: number;
  /** Dias até o aniversário (0 = hoje). */
  inDays: number;
  /** Arte de aniversário que o Marketing subiu para este ano (link assinado). */
  artUrl: string | null;
}

/** Aniversário de empresa: a pessoa completa mais um ano de casa. */
export interface HomeWorkAnniversary extends HomePerson {
  day: number;
  month: number;
  inDays: number;
  /** Anos de casa que completa. */
  years: number;
  artUrl: string | null;
}

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
  /** Quem está logado pode subir as artes de aniversário (Marketing e admin). */
  canManageBirthdayArts: boolean;
  /** Ferramentas da área da pessoa (as mesmas de Meus links). */
  links: WelcomeLink[];
  /** Atalhos favoritos salvos na conta; null quando a pessoa nunca personalizou. */
  favorites: string[] | null;
}
