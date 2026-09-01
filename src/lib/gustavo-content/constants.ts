export const GUSTAVO_CONTENT_STATUSES = [
  "radar",
  "sugestao",
  "aguardando_opiniao",
  "rascunho",
  "aguardando_aprovacao",
  "aprovado",
  "enviado_mkt",
  "publicado",
  "rejeitado",
  "arquivado",
] as const;

export type GustavoContentStatus = (typeof GUSTAVO_CONTENT_STATUSES)[number];

export const GUSTAVO_CONTENT_SOURCES = [
  "rss",
  "manual_link",
  "manual_idea",
  "thesis",
] as const;

export type GustavoContentSource = (typeof GUSTAVO_CONTENT_SOURCES)[number];

export const GUSTAVO_CONTENT_MODEL =
  process.env.GUSTAVO_CONTENT_MODEL ?? "gpt-4.1-mini";

export const GUSTAVO_WEEKLY_LINKEDIN_TARGET = 2;
export const GUSTAVO_WEEKLY_REEL_TARGET = 1;

/** Conta seedada do Gustavo Bismarchi Motta — identidade, não nome. */
export const GUSTAVO_OWNER_USER_ID = "9394f718-5e3a-4b2a-ae53-84faefcd4c7e";

export const SCORE_DISCARD_BELOW = 55;
export const SCORE_SUGGESTION_FROM = 70;
export const DEDUPE_WINDOW_DAYS = 120;
export const HISTORY_WINDOW_DAYS = 180;

export const SCORE_MAX = {
  icpRelevance: 25,
  thesisPotential: 20,
  businessImpact: 15,
  thesisFit: 10,
  freshness: 10,
  differentiation: 10,
  sourceQuality: 10,
} as const;

export const GUSTAVO_PLANNER_REQUESTING_AREA = "Marketing";
export const GUSTAVO_PLANNER_ASSIGNEE_NAME =
  process.env.GUSTAVO_PLANNER_ASSIGNEE_NAME?.trim() || null;

export const GUSTAVO_CONTENT_STATUS_LABELS: Record<
  (typeof GUSTAVO_CONTENT_STATUSES)[number],
  string
> = {
  radar: "Radar",
  sugestao: "Sugestão",
  aguardando_opiniao: "Aguardando opinião",
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  enviado_mkt: "Enviado ao Planner",
  publicado: "Publicado",
  rejeitado: "Rejeitado",
  arquivado: "Arquivado",
};
