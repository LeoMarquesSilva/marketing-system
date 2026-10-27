/**
 * Cálculos do Clima Organizacional no padrão de mercado (GPTW, Culture Amp):
 * cada afirmação vira três faixas, e o índice usado é o % favorável
 * (Concordo + Concordo totalmente). A referência de 70% é a nota mínima de
 * certificação do GPTW.
 */

import type {
  ActionPlan,
  ClimaTheme,
  ClimaTodo,
  Indicator,
  Statement,
} from "./clima-types";

/** % favorável mínimo para um tema ou afirmação ser considerado saudável */
export const FAVORABLE_TARGET = 70;
/** Neutro a partir disso sugere dúvida ou falta de informação */
export const HIGH_NEUTRAL = 25;

export interface Favorability {
  favorable: number;
  neutral: number;
  unfavorable: number;
}

export type Criticity = "critico" | "atencao" | "bom";

export interface ThemeSummary {
  theme: ClimaTheme;
  dimension: Indicator;
  statements: Statement[];
  favorability: Favorability;
}

/** Converte [DT, D, N, C, CT] nas três faixas, normalizando pelo total */
export function favorability(scores: number[]): Favorability {
  const [dt = 0, d = 0, n = 0, c = 0, ct = 0] = scores;
  const total = dt + d + n + c + ct;
  if (total <= 0) return { favorable: 0, neutral: 0, unfavorable: 0 };
  return {
    favorable: ((c + ct) / total) * 100,
    neutral: (n / total) * 100,
    unfavorable: ((dt + d) / total) * 100,
  };
}

/** Média simples das afirmações (cada uma pesa igual, como no GPTW) */
export function averageFavorability(statements: Statement[]): Favorability {
  if (statements.length === 0) return { favorable: 0, neutral: 0, unfavorable: 0 };
  const sum = statements.reduce(
    (acc, s) => {
      const f = favorability(s.scores);
      return {
        favorable: acc.favorable + f.favorable,
        neutral: acc.neutral + f.neutral,
        unfavorable: acc.unfavorable + f.unfavorable,
      };
    },
    { favorable: 0, neutral: 0, unfavorable: 0 }
  );
  return {
    favorable: sum.favorable / statements.length,
    neutral: sum.neutral / statements.length,
    unfavorable: sum.unfavorable / statements.length,
  };
}

export function getCriticity(favorablePercent: number): Criticity {
  if (favorablePercent < 50) return "critico";
  if (favorablePercent < FAVORABLE_TARGET) return "atencao";
  return "bom";
}

export function allStatements(indicadores: Indicator[]): Statement[] {
  return indicadores.flatMap((ind) => ind.statements);
}

/** Temas na ordem do modelo (dimensão → tema), com a favorabilidade de cada um */
export function summarizeThemes(indicadores: Indicator[]): ThemeSummary[] {
  return indicadores.flatMap((dimension) =>
    dimension.themes.map((theme) => {
      const statements = dimension.statements.filter((s) => s.themeId === theme.id);
      return { theme, dimension, statements, favorability: averageFavorability(statements) };
    })
  );
}

export function overallSummary(indicadores: Indicator[]) {
  const statements = allStatements(indicadores);
  return {
    ...averageFavorability(statements),
    total: statements.length,
    aboveTarget: statements.filter((s) => favorability(s.scores).favorable >= FAVORABLE_TARGET)
      .length,
  };
}

/** Focos de ação: temas abaixo da referência, do pior para o melhor */
export function focusThemes(summaries: ThemeSummary[]): ThemeSummary[] {
  return summaries
    .filter((t) => t.favorability.favorable < FAVORABLE_TARGET)
    .sort((a, b) => a.favorability.favorable - b.favorability.favorable);
}

/** Afirmações abaixo da referência, da menos favorável para a mais */
export function attentionStatements(indicadores: Indicator[]): Statement[] {
  return allStatements(indicadores)
    .filter((s) => favorability(s.scores).favorable < FAVORABLE_TARGET)
    .sort((a, b) => favorability(a.scores).favorable - favorability(b.scores).favorable);
}

export function plansForTheme(themeId: string, plans: ActionPlan[]): ActionPlan[] {
  return plans.filter((p) => p.themeIds?.includes(themeId));
}

/** Tarefas ligadas ao tema direto ou por meio de um plano do tema */
export function todosForTheme(
  themeId: string,
  plans: ActionPlan[],
  todos: ClimaTodo[]
): ClimaTodo[] {
  const planIds = new Set(plansForTheme(themeId, plans).map((p) => p.id));
  return todos.filter(
    (t) => t.indicatorId === themeId || (t.actionPlanId != null && planIds.has(t.actionPlanId))
  );
}

export function findTheme(indicadores: Indicator[], themeId: string | undefined) {
  if (!themeId) return undefined;
  return summarizeThemes(indicadores).find((t) => t.theme.id === themeId);
}

export interface PersonRef {
  name: string;
  avatarUrl: string | null;
  /** "grupo" para responsáveis que não são uma pessoa ("Gestores", "Gente e Gestão") */
  kind: "pessoa" | "grupo";
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Transforma o texto de responsável do plano ("Caroline e Midian", "Emanueli")
 * em pessoas com foto. Só separa os nomes quando todos batem com um único
 * usuário pelo primeiro nome; "Gente e Gestão" continua como um grupo.
 */
export function resolveResponsibles(
  responsible: string,
  users: { name: string; avatar_url: string | null }[]
): PersonRef[] {
  const raw = responsible.trim();
  if (!raw) return [];
  const exact = users.find((u) => normalize(u.name) === normalize(raw));
  if (exact) return [{ name: exact.name, avatarUrl: exact.avatar_url, kind: "pessoa" }];

  const parts = raw.split(/\s*,\s*|\s+e\s+/).filter(Boolean);
  const matches = parts.map((part) => {
    const first = normalize(part).split(/\s+/)[0];
    const found = users.filter((u) => normalize(u.name).split(/\s+/)[0] === first);
    return found.length === 1 ? found[0] : null;
  });
  if (matches.every((m) => m != null)) {
    return matches.map((m) => ({ name: m!.name, avatarUrl: m!.avatar_url, kind: "pessoa" as const }));
  }
  // Primeiro nome ambíguo ainda é uma pessoa; cargos e textos longos são grupo
  const isGroupWord = /^(gestor|gestores|lideranca|equipe|comissao|rh|gente|socios?)$/.test(
    normalize(raw)
  );
  const kind = parts.length === 1 && !/\s/.test(raw) && !isGroupWord ? "pessoa" : "grupo";
  return [{ name: raw, avatarUrl: null, kind }];
}

/** Responsável de uma tarefa (nome completo do usuário) com a foto, se houver */
export function personFromUserName(
  name: string | undefined,
  users: { name: string; avatar_url: string | null }[]
): PersonRef[] {
  if (!name) return [];
  const user = users.find((u) => u.name === name);
  return [{ name, avatarUrl: user?.avatar_url ?? null, kind: "pessoa" }];
}
