/** PE27 (Planejamento Estratégico 2027): tipos compartilhados entre servidor e telas. */

export const PE27_PATH = "/pe27";
export const PE27_INSUMOS_PATH = "/pe27/insumos";
export const PE27_DINAMICA1_PATH = "/pe27/dinamica-1";
export const PE27_CYCLE = "PE27";

export const DIMENSIONS = ["clientes", "pessoas", "acionistas"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  clientes: "Clientes",
  pessoas: "Pessoas",
  acionistas: "Acionistas",
};

/** Temas da Dinâmica 1 (um por grupo): o que nos aproximou e afastou de cada um. */
export const THEMES = ["visao", "missao", "valores", "proposito"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  visao: "Visão",
  missao: "Missão",
  valores: "Valores",
  proposito: "Propósito",
};

export type Direction = "aproximou" | "afastou";

/** Decisão dos sócios sobre cada alavanca ou meta (revisão de 11/11). */
export const DECISIONS = ["em_analise", "mantida", "ajustada", "juntada", "descartada"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  em_analise: "Em análise",
  mantida: "Mantida",
  ajustada: "Ajustada",
  juntada: "Juntada",
  descartada: "Descartada",
};

/** Verbo do botão de decisão (o rótulo do status fica no feminino de "alavanca"/"meta"). */
export const DECISION_ACTIONS: Record<Decision, string> = {
  em_analise: "Em análise",
  mantida: "Manter",
  ajustada: "Ajustar",
  juntada: "Juntar",
  descartada: "Descartar",
};

/** Decisões que deixam o item no plano (mantido ou ajustado). */
export function staysInPlan(status: Decision): boolean {
  return status === "mantida" || status === "ajustada";
}

export interface Pe27Person {
  name: string;
  short_name: string;
  avatar_url: string | null;
}

export interface Pe27Member extends Pe27Person {
  id: string;
  area: string | null;
  is_area_partner: boolean;
}

export interface Pe27Group {
  id: string;
  dynamic: number;
  dimension: Dimension | null;
  /** Tema do grupo na Dinâmica 1. */
  theme: Theme | null;
  /** Texto proposto pelo grupo (ex.: proposta de missão). */
  proposal: string | null;
  notes: string | null;
  /** Rotas internas das fotos dos rascunhos. */
  sketch_urls: string[];
  name: string;
  poster_title: string | null;
  /** Rota interna que abre a foto do cartaz (link assinado). */
  poster_url: string | null;
  members: Pe27Member[];
}

export interface Pe27Goal {
  id: string;
  lever_id: string;
  position: number;
  text: string;
  original_text: string | null;
  transcription_note: string | null;
  status: Decision;
  merged_into: string | null;
  decision_note: string | null;
  baseline: string | null;
  target: string | null;
  data_source: string | null;
  updated_at: string;
  updated_by_name: string | null;
}

export interface Pe27Lever {
  id: string;
  dimension: Dimension;
  group_id: string | null;
  position: number;
  title: string;
  original_title: string | null;
  transcription_note: string | null;
  status: Decision;
  merged_into: string | null;
  decision_note: string | null;
  updated_at: string;
  updated_by_name: string | null;
  goals: Pe27Goal[];
}

/** Item da matriz aproximou × afastou da Dinâmica 1. */
export interface Pe27Reflection {
  id: string;
  group_id: string;
  direction: Direction;
  position: number;
  text: string;
  /** Como está no rascunho, quando diz mais que o cartaz. */
  detail: string | null;
  /** Recorte dentro do tema (Valores: a letra do CIVIL). */
  facet: string | null;
  source: "cartaz" | "rascunho";
  transcription_note: string | null;
}

export interface Pe27Conductor extends Pe27Person {
  role: string;
}

export interface Pe27Board {
  /** Admin altera; quem tem só a chave /pe27 lê. */
  can_edit: boolean;
  groups: Pe27Group[];
  levers: Pe27Lever[];
  reflections: Pe27Reflection[];
  conductors: Pe27Conductor[];
  files: { presentation_url: string; groups_sheet_url: string; dinamica1_groups_sheet_url: string };
}

/** Texto da meta/alavanca para busca de temas comuns (sem acento, minúsculo). */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function formatPe27DateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}
