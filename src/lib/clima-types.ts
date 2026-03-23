/**
 * Tipos para o módulo de Clima Organizacional
 * Baseado na pesquisa de clima extraída do Miro/CSV
 *
 * LEGENDA (ordem fixa dos scores - escala Likert 5 pontos):
 * [0] Discordo totalmente
 * [1] Discordo
 * [2] Nem discordo, nem concordo
 * [3] Concordo
 * [4] Concordo totalmente
 *
 * Sempre usar 5 valores; usar 0 quando a categoria não teve respostas.
 */
export const SCORE_LABELS = [
  "Discordo totalmente",
  "Discordo",
  "Nem discordo, nem concordo",
  "Concordo",
  "Concordo totalmente",
] as const;

export type PracticeType = "acelerar" | "evitar" | "comecar";

export interface Statement {
  id: string;
  text: string;
  /** Percentuais na ordem da legenda: [DT, D, N, C, CT] - sempre 5 valores */
  scores: number[];
  practiceType?: PracticeType;
  actions?: string[];
}

export interface Indicator {
  id: string;
  name: string;
  question: string;
  statements: Statement[];
  actions: string[];
}

export type ActionPlanPriority =
  | "urgente"
  | "programar"
  | "delegar"
  | "nao_fazer";

export interface ActionPlan {
  id: string;
  title: string;
  what: string;
  why: string;
  who: string;
  where: string;
  when: string;
  how: string;
  howMuch: string;
  priority: ActionPlanPriority;
  status: "backlog" | "em_andamento" | "concluido";
  responsible: string;
  indicatorId?: string;
}

export interface ClimaTodo {
  id: string;
  title: string;
  description?: string;
  responsible?: string;
  dueDate?: string;
  status: "pendente" | "em_andamento" | "concluido";
  priority: "alta" | "normal" | "baixa";
  actionPlanId?: string;
  indicatorId?: string;
  createdAt: string;
}

export interface QuantitativeIndicator {
  id: string;
  name: string;
  /** Pergunta da pesquisa (ex.: "Como você avalia a comunicação interna?") */
  question?: string;
  /** Distribuição de respostas em % (para gráficos de barras) */
  scores?: number[];
  labels?: string[];
  /** Média da nota (para indicadores de escala 0–10) */
  averageScore?: number;
  /** Escala máxima (ex.: 10) */
  scaleMax?: number;
  /** Número de respostas */
  responseCount?: number;
  analysis?: string;
}
