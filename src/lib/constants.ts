/**
 * Constantes alinhadas ao Excel "Solicitações Marketing"
 * Áreas e tipos extraídos da planilha real
 */

// Áreas do Excel + departamentos do sistema de usuários (app_c009c0e4f1_users_rows)
export const AREAS = [
  "Cível",
  "Trabalhista",
  "Operações Legais",
  "Reestruturação",
  "Marketing",
  "Societário e Contratos",
  "Sócio",
  "Distressed Deals - Special Situations",
  "Geral",
  "T.I",
] as const;

/**
 * Tipos de solicitação padronizados (escrita correta)
 * Usados no select do formulário e validados no banco
 */
export const REQUEST_TYPES = [
  "Comunicado",
  "PPT",
  "Post Redes Sociais",
  "Aplicação de Identidade",
  "Certificados",
  "E-book",
  "Identidade Visual",
  "Newsletter",
  "Material Impresso",
  "Relatório",
  "Apresentação",
] as const;

export const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluído" },
] as const;

/**
 * Etapas do workflow do Kanban Planner
 */
export const WORKFLOW_STAGES = [
  { value: "tarefas", label: "Tarefas" },
  { value: "revisao", label: "Revisão" },
  { value: "revisado", label: "Revisado" },
  { value: "revisao_autor", label: "Revisão autor" },
  { value: "concluido", label: "Concluído" },
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number]["value"];

/**
 * Tipos de conclusão (quando workflow_stage = concluido)
 */
export const COMPLETION_TYPES = [
  { value: "design_concluido", label: "Design concluído" },
  { value: "postagem_feita", label: "Postagem feita" },
  { value: "conteudo_entregue", label: "Conteúdo entregue" },
] as const;

export type CompletionType = (typeof COMPLETION_TYPES)[number]["value"];
