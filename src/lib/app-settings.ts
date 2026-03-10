"use server";

import { unstable_cache } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { COMPLETION_TYPES } from "@/lib/constants";

// --- Types (aligned with DB JSON) ---

export interface WorkflowStageConfig {
  value: string;
  label: string;
  sortOrder: number;
  showInKanban: boolean;
}

export type PlannerTabId = "kanban" | "concluidos" | "posts";

export interface CompletionTypeConfig {
  value: string;
  label: string;
}

/** Quem vê o quê no Kanban: admin vê tudo, designer só suas tarefas | todos veem todas as tarefas */
export type KanbanVisibility = "designer_own_admin_all" | "everyone_all";

/** Regras ao mover tarefa para uma etapa (ex.: exibir diálogo, manter responsável) */
export interface StageMoveRule {
  showArtLinkDialog?: boolean;
  keepAssignee?: boolean;
}

export type StageMoveRules = Record<string, StageMoveRule>;

export interface AppSettings {
  workflowStages: WorkflowStageConfig[];
  plannerTabs: PlannerTabId[];
  completionTypes: CompletionTypeConfig[];
  kanbanVisibility: KanbanVisibility;
  stageMoveRules: StageMoveRules;
}

// --- Defaults (fallback when DB is empty or fails) ---

const DEFAULT_WORKFLOW_STAGES: WorkflowStageConfig[] = [
  { value: "tarefas", label: "Tarefas", sortOrder: 0, showInKanban: true },
  { value: "revisao", label: "Revisão", sortOrder: 1, showInKanban: true },
  { value: "revisado", label: "Revisado", sortOrder: 2, showInKanban: true },
  { value: "revisao_autor", label: "Revisão autor", sortOrder: 3, showInKanban: true },
  { value: "concluido", label: "Concluído", sortOrder: 4, showInKanban: false },
];

const DEFAULT_PLANNER_TABS: PlannerTabId[] = ["kanban", "concluidos", "posts"];

const DEFAULT_COMPLETION_TYPES: CompletionTypeConfig[] = COMPLETION_TYPES.map(
  (c) => ({ value: c.value, label: c.label })
);

const DEFAULT_KANBAN_VISIBILITY: KanbanVisibility = "designer_own_admin_all";

const DEFAULT_STAGE_MOVE_RULES: StageMoveRules = {
  revisao: { showArtLinkDialog: true, keepAssignee: false },
};

function parseWorkflowStages(value: unknown): WorkflowStageConfig[] {
  if (!Array.isArray(value)) return DEFAULT_WORKFLOW_STAGES;
  const parsed = value
    .filter(
      (item): item is Record<string, unknown> =>
        item != null && typeof item === "object"
    )
    .map((item) => ({
      value: String(item.value ?? ""),
      label: String(item.label ?? ""),
      sortOrder: Number(item.sortOrder ?? 0),
      showInKanban: Boolean(item.showInKanban ?? true),
    }))
    .filter((s) => s.value && s.label);
  if (parsed.length === 0) return DEFAULT_WORKFLOW_STAGES;
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder);
}

function parsePlannerTabs(value: unknown): PlannerTabId[] {
  if (!Array.isArray(value)) return DEFAULT_PLANNER_TABS;
  const valid: PlannerTabId[] = ["kanban", "concluidos", "posts"];
  const filtered = value.filter(
    (t): t is PlannerTabId => typeof t === "string" && valid.includes(t as PlannerTabId)
  );
  const unique = [...new Set(filtered)];
  return unique.length > 0 ? unique : DEFAULT_PLANNER_TABS;
}

function parseCompletionTypes(value: unknown): CompletionTypeConfig[] {
  if (!Array.isArray(value)) return DEFAULT_COMPLETION_TYPES;
  const parsed = value
    .filter(
      (item): item is Record<string, unknown> =>
        item != null && typeof item === "object"
    )
    .map((item) => ({
      value: String(item.value ?? ""),
      label: String(item.label ?? ""),
    }))
    .filter((c) => c.value && c.label);
  return parsed.length > 0 ? parsed : DEFAULT_COMPLETION_TYPES;
}

function parseKanbanVisibility(value: unknown): KanbanVisibility {
  if (value === "designer_own_admin_all" || value === "everyone_all") return value;
  return DEFAULT_KANBAN_VISIBILITY;
}

function parseStageMoveRules(value: unknown): StageMoveRules {
  if (!value || typeof value !== "object") return DEFAULT_STAGE_MOVE_RULES;
  const obj = value as Record<string, unknown>;
  const out: StageMoveRules = {};
  for (const [stage, rule] of Object.entries(obj)) {
    if (rule && typeof rule === "object") {
      const r = rule as Record<string, unknown>;
      out[stage] = {
        showArtLinkDialog: Boolean(r.showArtLinkDialog ?? true),
        keepAssignee: Boolean(r.keepAssignee ?? false),
      };
    }
  }
  return Object.keys(out).length > 0 ? out : DEFAULT_STAGE_MOVE_RULES;
}

/** Monta AppSettings a partir do mapa bruto (ex.: retorno da API). Usado pela rota POST /api/admin/settings. */
export async function parseAppSettingsFromMap(
  map: Map<string, unknown> | null
): Promise<AppSettings> {
  return {
    workflowStages: parseWorkflowStages(map?.get("workflow_stages")),
    plannerTabs: parsePlannerTabs(map?.get("planner_tabs")),
    completionTypes: parseCompletionTypes(map?.get("completion_types")),
    kanbanVisibility: parseKanbanVisibility(map?.get("kanban_visibility")),
    stageMoveRules: parseStageMoveRules(map?.get("stage_move_rules")),
  };
}

// --- Server-only: fetch from DB (no cache) ---

async function fetchAppSettingsRaw() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value");

  if (error) {
    console.error("app-settings fetch error:", error.message);
    return null;
  }

  const map = new Map<string, unknown>();
  for (const row of data ?? []) {
    map.set(row.key, row.value);
  }
  return map;
}

// --- Cached public API (não usar em rotas que já usam cookies/createClient no mesmo fluxo) ---

/** Busca settings sem cache. Use em Server Components que não podem usar unstable_cache com createClient (ex.: /planner). */
export async function getAppSettingsUncached(): Promise<AppSettings> {
  const map = await fetchAppSettingsRaw();
  return {
    workflowStages: parseWorkflowStages(map?.get("workflow_stages")),
    plannerTabs: parsePlannerTabs(map?.get("planner_tabs")),
    completionTypes: parseCompletionTypes(map?.get("completion_types")),
    kanbanVisibility: parseKanbanVisibility(map?.get("kanban_visibility")),
    stageMoveRules: parseStageMoveRules(map?.get("stage_move_rules")),
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  return unstable_cache(getAppSettingsUncached, ["app-settings"], {
    revalidate: 60,
    tags: ["app-settings"],
  })();
}

/**
 * Versão para chamada a partir do cliente (server action). Não usa unstable_cache
 * para evitar erro de contexto quando invocado como action.
 */
export async function getAppSettingsForClient(): Promise<AppSettings> {
  return getAppSettingsUncached();
}

// --- Admin: server actions (require role === 'admin') ---

async function ensureAdmin() {
  const supabase = await createClient();
  // getSession() lê do cookie; getUser() pode falhar em server actions
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  const role = (profile?.role as string | null)?.toLowerCase?.();
  if (role !== "admin") return { error: "Acesso negado. Apenas administradores." };
  return { supabase };
}

function validateWorkflowStages(stages: WorkflowStageConfig[]): string | null {
  const values = new Set(stages.map((s) => s.value));
  if (values.size !== stages.length) return "Valores de etapa devem ser únicos.";
  const concluido = stages.find((s) => s.value === "concluido");
  if (!concluido) return "Deve existir a etapa 'concluido'.";
  if (concluido.showInKanban) return "A etapa 'concluido' não deve exibir no Kanban.";
  return null;
}

function validatePlannerTabs(tabs: PlannerTabId[]): string | null {
  if (tabs.length === 0) return "Pelo menos uma aba deve estar habilitada.";
  return null;
}

export async function updateWorkflowStages(
  stages: WorkflowStageConfig[]
): Promise<{ error: string | null }> {
  const err = validateWorkflowStages(stages);
  if (err) return { error: err };

  const result = await ensureAdmin();
  if (result.error) return { error: result.error };
  if (!result.supabase) return { error: "Erro de autenticação." };
  const { supabase } = result;

  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        key: "workflow_stages",
        value: stages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) return { error: error.message };
  return { error: null };
}

export async function updatePlannerTabs(
  tabs: PlannerTabId[]
): Promise<{ error: string | null }> {
  const err = validatePlannerTabs(tabs);
  if (err) return { error: err };

  const result = await ensureAdmin();
  if (result.error) return { error: result.error };
  if (!result.supabase) return { error: "Erro de autenticação." };
  const { supabase } = result;

  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        key: "planner_tabs",
        value: tabs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) return { error: error.message };
  return { error: null };
}

export async function updateCompletionTypes(
  types: CompletionTypeConfig[]
): Promise<{ error: string | null }> {
  if (types.length === 0) return { error: "Pelo menos um tipo de conclusão é necessário." };

  const result = await ensureAdmin();
  if (result.error) return { error: result.error };
  if (!result.supabase) return { error: "Erro de autenticação." };
  const { supabase } = result;

  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        key: "completion_types",
        value: types,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) return { error: error.message };
  return { error: null };
}

export async function updateKanbanRules(
  kanbanVisibility: KanbanVisibility,
  stageMoveRules: StageMoveRules
): Promise<{ error: string | null }> {
  const result = await ensureAdmin();
  if (result.error) return { error: result.error };
  if (!result.supabase) return { error: "Erro de autenticação." };
  const { supabase } = result;

  const { error: err1 } = await supabase
    .from("app_settings")
    .upsert(
      { key: "kanban_visibility", value: kanbanVisibility, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (err1) return { error: err1.message };

  const { error: err2 } = await supabase
    .from("app_settings")
    .upsert(
      { key: "stage_move_rules", value: stageMoveRules, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (err2) return { error: err2.message };
  return { error: null };
}
