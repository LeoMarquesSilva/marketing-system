import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { canEditPe27, hasPe27Access } from "@/lib/access-control";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { loadPeopleDirectory } from "@/lib/rh/people-directory";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { PE27_CONDUCAO, PE27_FILES } from "./conteudo";
import {
  DECISIONS,
  DIMENSIONS,
  PE27_CYCLE,
  type Decision,
  type Dimension,
  type Pe27Board,
  type Pe27Conductor,
  type Pe27Goal,
  type Pe27Group,
  type Pe27Lever,
  type Pe27Reflection,
  type Theme,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LOG = "pe27";
const BUCKET = "PE27";
const SIGNED_URL_SECONDS = 10 * 60;

export class Pe27HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "Pe27HttpError";
  }
}

export function toPe27ApiError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof Pe27HttpError || error instanceof RhHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  console.error(`[${LOG}]`, error);
  return { status: 500, body: { error: "Erro interno.", code: "INTERNAL" } };
}

function createPe27AdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new Pe27HttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

interface Pe27Viewer {
  profileId: string;
  name: string;
  canEdit: boolean;
}

/** Sessão + acesso ao PE27 (admin, ou a chave /pe27 só para ler). */
async function requirePe27Viewer(db: SupabaseClient): Promise<Pe27Viewer> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new Pe27HttpError("Não autenticado.", 401, "UNAUTHENTICATED");
  const { data, error } = await db.from("users").select("id, name, role, permissions, is_active").eq("auth_id", user.id).maybeSingle();
  if (error || !data) throw new Pe27HttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  if (data.is_active === false) throw new Pe27HttpError("Usuário inativo.", 403, "FORBIDDEN");
  const profile = { role: data.role as string | null, permissions: (data.permissions as string[] | null) ?? null };
  if (!hasPe27Access(profile)) {
    throw new Pe27HttpError("Você não tem acesso ao PE27.", 403, "FORBIDDEN");
  }
  return { profileId: data.id as string, name: (data.name as string) ?? "", canEdit: canEditPe27(profile) };
}

/** Escrita (decisões, textos, itens novos): só admin. */
async function requirePe27Editor(db: SupabaseClient): Promise<Pe27Viewer> {
  const viewer = await requirePe27Viewer(db);
  if (!viewer.canEdit) throw new Pe27HttpError("Só administradores alteram o PE27.", 403, "READ_ONLY");
  return viewer;
}

/* ------------------------------------------------------------------ leitura */

const LEVER_COLUMNS =
  "id, dimension, group_id, position, title, original_title, transcription_note, status, merged_into, decision_note, updated_at, updated_by, created_at";
const GOAL_COLUMNS =
  "id, lever_id, position, text, original_text, transcription_note, status, merged_into, decision_note, baseline, target, data_source, updated_at, updated_by, created_at";

type LeverRow = Omit<Pe27Lever, "goals" | "updated_by_name"> & { updated_by: string | null; created_at: string };
type GoalRow = Omit<Pe27Goal, "updated_by_name"> & { updated_by: string | null; created_at: string };

function fileUrl(path: string, download = false): string {
  const params = new URLSearchParams({ caminho: path });
  if (download) params.set("baixar", "1");
  return `/api/pe27/arquivos?${params.toString()}`;
}

/** Ordem: posição no cartaz; as criadas na revisão vão para o fim, pela data. */
function byPosition<T extends { position: number; created_at: string }>(a: T, b: T): number {
  return a.position - b.position || a.created_at.localeCompare(b.created_at);
}

export async function loadPe27Board(): Promise<Pe27Board> {
  const db = createPe27AdminClient();
  const viewer = await requirePe27Viewer(db);

  const [groupsResult, membersResult, leversResult, goalsResult, reflectionsResult, people] = await Promise.all([
    db
      .from("strategic_plan_groups")
      .select("id, dynamic, dimension, theme, name, poster_title, poster_path, sketch_paths, proposal, notes, sort")
      .eq("cycle", PE27_CYCLE)
      .order("dynamic")
      .order("sort"),
    db.from("strategic_plan_group_members").select("id, group_id, employee_id, name, area, is_area_partner, sort").order("sort"),
    db.from("strategic_plan_levers").select(LEVER_COLUMNS).eq("cycle", PE27_CYCLE),
    db.from("strategic_plan_goals").select(GOAL_COLUMNS),
    db
      .from("strategic_plan_reflections")
      .select("id, group_id, direction, position, text, detail, facet, source, transcription_note")
      .order("position"),
    loadPeopleDirectory(db, LOG),
  ]);
  for (const result of [groupsResult, membersResult, leversResult, goalsResult, reflectionsResult]) {
    if (result.error) {
      console.error(`[${LOG}] leitura:`, result.error);
      throw new Pe27HttpError("Falha ao carregar o PE27.", 500, "QUERY_FAILED");
    }
  }

  const personByEmployee = new Map(people.map((person) => [person.id, person]));
  const leverRows = (leversResult.data ?? []) as LeverRow[];
  const leverIds = new Set(leverRows.map((lever) => lever.id));
  const goalRows = ((goalsResult.data ?? []) as GoalRow[]).filter((goal) => leverIds.has(goal.lever_id));

  // Quem mexeu por último (nome curto), e fotos dos consultores que só existem em users.
  const userIds = new Set<string>();
  for (const row of [...leverRows, ...goalRows]) if (row.updated_by) userIds.add(row.updated_by);
  for (const item of PE27_CONDUCAO) if (item.userId) userIds.add(item.userId);
  const usersById = new Map<string, { name: string; avatar_url: string | null }>();
  if (userIds.size) {
    const { data, error } = await db
      .from("users")
      .select("id, name, avatar_url, photo_onedrive_url")
      .in("id", [...userIds]);
    if (error) console.error(`[${LOG}] usuários:`, error);
    for (const user of data ?? []) {
      usersById.set(user.id as string, {
        name: (user.name as string) ?? "",
        avatar_url: resolveEmployeeAvatarUrl(user.avatar_url as string | null, user.photo_onedrive_url as string | null),
      });
    }
  }
  const firstName = (id: string | null) => (id ? (usersById.get(id)?.name.split(/\s+/)[0] ?? null) : null);

  const groups: Pe27Group[] = (groupsResult.data ?? []).map((group) => ({
    id: group.id as string,
    dynamic: group.dynamic as number,
    dimension: (group.dimension as Dimension | null) ?? null,
    theme: (group.theme as Theme | null) ?? null,
    proposal: (group.proposal as string | null) ?? null,
    notes: (group.notes as string | null) ?? null,
    sketch_urls: ((group.sketch_paths as string[] | null) ?? []).map((path) => fileUrl(path)),
    name: group.name as string,
    poster_title: (group.poster_title as string | null) ?? null,
    poster_url: group.poster_path ? fileUrl(group.poster_path as string) : null,
    members: (membersResult.data ?? [])
      .filter((member) => member.group_id === group.id)
      .map((member) => {
        const person = member.employee_id ? personByEmployee.get(member.employee_id as string) : undefined;
        return {
          id: member.id as string,
          name: member.name as string,
          short_name: member.name as string,
          avatar_url: person?.avatar_url ?? null,
          area: (member.area as string | null) ?? null,
          is_area_partner: Boolean(member.is_area_partner),
        };
      }),
  }));

  const goalsByLever = new Map<string, Pe27Goal[]>();
  for (const row of [...goalRows].sort(byPosition)) {
    const { updated_by, created_at: _createdAt, ...goal } = row;
    void _createdAt;
    goalsByLever.set(goal.lever_id, [...(goalsByLever.get(goal.lever_id) ?? []), { ...goal, updated_by_name: firstName(updated_by) }]);
  }
  const dimensionOrder = (dimension: Dimension) => DIMENSIONS.indexOf(dimension);
  const levers: Pe27Lever[] = [...leverRows]
    .sort((a, b) => dimensionOrder(a.dimension) - dimensionOrder(b.dimension) || byPosition(a, b))
    .map(({ updated_by, created_at: _createdAt, ...lever }) => {
      void _createdAt;
      return { ...lever, updated_by_name: firstName(updated_by), goals: goalsByLever.get(lever.id) ?? [] };
    });

  const conductors: Pe27Conductor[] = PE27_CONDUCAO.flatMap((item) => {
    if (item.employeeId) {
      const person = personByEmployee.get(item.employeeId);
      return person ? [{ role: item.role, name: person.full_name, short_name: person.short_name, avatar_url: person.avatar_url }] : [];
    }
    const user = item.userId ? usersById.get(item.userId) : undefined;
    return user ? [{ role: item.role, name: user.name, short_name: user.name, avatar_url: user.avatar_url }] : [];
  });

  const groupIds = new Set(groups.map((group) => group.id));
  const reflections = ((reflectionsResult.data ?? []) as Pe27Reflection[]).filter((item) => groupIds.has(item.group_id));

  return {
    can_edit: viewer.canEdit,
    groups,
    levers,
    reflections,
    conductors,
    files: {
      presentation_url: fileUrl(PE27_FILES.presentation, true),
      groups_sheet_url: fileUrl(PE27_FILES.groupsSheet),
      dinamica1_groups_sheet_url: fileUrl(PE27_FILES.groupsSheetDinamica1),
    },
  };
}

/** Link assinado de um arquivo do bucket PE27 (cartazes e material do workshop). */
export async function signedPe27FileUrl(path: string, download: boolean): Promise<string> {
  const db = createPe27AdminClient();
  await requirePe27Viewer(db);
  if (!/^[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp|pdf|pptx)$/i.test(path)) {
    throw new Pe27HttpError("Arquivo inválido.", 400, "INVALID_INPUT");
  }
  const fileName = path.split("/").pop() ?? path;
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download: fileName } : undefined);
  if (error || !data?.signedUrl) {
    console.error(`[${LOG}] arquivo:`, error);
    throw new Pe27HttpError("Arquivo não encontrado.", 404, "NOT_FOUND");
  }
  return data.signedUrl;
}

/* ------------------------------------------------------------------ escrita */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

const decisionFields = {
  status: z.enum(DECISIONS).optional(),
  merged_into: z.string().uuid().nullable().optional(),
  decision_note: optionalText(2000),
};

export const leverPatchSchema = z.object({
  title: z.string().trim().min(1, "Escreva a alavanca.").max(200).optional(),
  dimension: z.enum(DIMENSIONS).optional(),
  ...decisionFields,
});

export const leverCreateSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  title: z.string().trim().min(1, "Escreva a alavanca.").max(200),
});

export const goalPatchSchema = z.object({
  text: z.string().trim().min(1, "Escreva a meta.").max(300).optional(),
  lever_id: z.string().uuid().optional(),
  baseline: optionalText(200),
  target: optionalText(200),
  data_source: optionalText(200),
  ...decisionFields,
});

export const goalCreateSchema = z.object({
  lever_id: z.string().uuid(),
  text: z.string().trim().min(1, "Escreva a meta.").max(300),
});

type LeverPatch = z.infer<typeof leverPatchSchema>;
type GoalPatch = z.infer<typeof goalPatchSchema>;

/** "Juntada" precisa dizer com quem; qualquer outra decisão limpa o vínculo. */
async function resolveMerge(
  db: SupabaseClient,
  table: "strategic_plan_levers" | "strategic_plan_goals",
  id: string,
  status: Decision | undefined,
  mergedInto: string | null | undefined,
): Promise<{ merged_into?: string | null }> {
  if (status === undefined && mergedInto === undefined) return {};
  if (status !== undefined && status !== "juntada") return { merged_into: null };
  if (status === "juntada" && !mergedInto) {
    throw new Pe27HttpError("Escolha com qual item ela foi juntada.", 400, "MERGE_TARGET_REQUIRED");
  }
  if (!mergedInto) return { merged_into: null };
  if (mergedInto === id) throw new Pe27HttpError("Um item não pode ser juntado com ele mesmo.", 400, "INVALID_MERGE");
  const { data, error } = await db.from(table).select("id, status").eq("id", mergedInto).maybeSingle();
  if (error || !data) throw new Pe27HttpError("O item de destino não existe mais.", 400, "INVALID_MERGE");
  if (data.status === "juntada" || data.status === "descartada") {
    throw new Pe27HttpError("Junte com um item que vai ficar no plano (não juntado nem descartado).", 400, "INVALID_MERGE");
  }
  return { merged_into: mergedInto };
}

function dropUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export async function updateLever(id: string, patch: LeverPatch): Promise<void> {
  const db = createPe27AdminClient();
  const viewer = await requirePe27Editor(db);
  const merge = await resolveMerge(db, "strategic_plan_levers", id, patch.status, patch.merged_into);
  const { merged_into: _ignored, ...rest } = patch;
  void _ignored;
  const { data, error } = await db
    .from("strategic_plan_levers")
    .update({ ...dropUndefined(rest), ...merge, updated_by: viewer.profileId })
    .eq("id", id)
    .eq("cycle", PE27_CYCLE)
    .select("id");
  if (error) {
    console.error(`[${LOG}] alavanca:`, error);
    throw new Pe27HttpError("Não foi possível salvar a alavanca.", 500, "UPDATE_FAILED");
  }
  if (!data?.length) throw new Pe27HttpError("Alavanca não encontrada.", 404, "NOT_FOUND");
}

export async function createLever(input: z.infer<typeof leverCreateSchema>): Promise<string> {
  const db = createPe27AdminClient();
  const viewer = await requirePe27Editor(db);
  const { data: last } = await db
    .from("strategic_plan_levers")
    .select("position")
    .eq("cycle", PE27_CYCLE)
    .eq("dimension", input.dimension)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("strategic_plan_levers")
    .insert({
      cycle: PE27_CYCLE,
      dimension: input.dimension,
      title: input.title,
      position: ((last?.position as number | undefined) ?? 0) + 1,
      created_by: viewer.profileId,
      updated_by: viewer.profileId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[${LOG}] nova alavanca:`, error);
    throw new Pe27HttpError("Não foi possível criar a alavanca.", 500, "INSERT_FAILED");
  }
  return data.id as string;
}

/** Só apaga o que foi criado na revisão; o que veio do cartaz se descarta. */
export async function deleteLever(id: string): Promise<void> {
  const db = createPe27AdminClient();
  await requirePe27Editor(db);
  const { data, error } = await db.from("strategic_plan_levers").select("id, group_id").eq("id", id).maybeSingle();
  if (error || !data) throw new Pe27HttpError("Alavanca não encontrada.", 404, "NOT_FOUND");
  if (data.group_id) {
    throw new Pe27HttpError("Alavancas do workshop não se apagam: marque como descartada.", 400, "WORKSHOP_ITEM");
  }
  const { error: deleteError } = await db.from("strategic_plan_levers").delete().eq("id", id);
  if (deleteError) {
    console.error(`[${LOG}] apagar alavanca:`, deleteError);
    throw new Pe27HttpError("Não foi possível apagar a alavanca.", 500, "DELETE_FAILED");
  }
}

export async function updateGoal(id: string, patch: GoalPatch): Promise<void> {
  const db = createPe27AdminClient();
  const viewer = await requirePe27Editor(db);
  const merge = await resolveMerge(db, "strategic_plan_goals", id, patch.status, patch.merged_into);
  if (patch.lever_id) {
    const { data: lever } = await db
      .from("strategic_plan_levers")
      .select("id")
      .eq("id", patch.lever_id)
      .eq("cycle", PE27_CYCLE)
      .maybeSingle();
    if (!lever) throw new Pe27HttpError("Alavanca de destino não encontrada.", 400, "INVALID_LEVER");
  }
  const { merged_into: _ignored, ...rest } = patch;
  void _ignored;
  const { data, error } = await db
    .from("strategic_plan_goals")
    .update({ ...dropUndefined(rest), ...merge, updated_by: viewer.profileId })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error(`[${LOG}] meta:`, error);
    throw new Pe27HttpError("Não foi possível salvar a meta.", 500, "UPDATE_FAILED");
  }
  if (!data?.length) throw new Pe27HttpError("Meta não encontrada.", 404, "NOT_FOUND");
}

export async function createGoal(input: z.infer<typeof goalCreateSchema>): Promise<string> {
  const db = createPe27AdminClient();
  const viewer = await requirePe27Editor(db);
  const { data: lever } = await db
    .from("strategic_plan_levers")
    .select("id")
    .eq("id", input.lever_id)
    .eq("cycle", PE27_CYCLE)
    .maybeSingle();
  if (!lever) throw new Pe27HttpError("Alavanca não encontrada.", 404, "NOT_FOUND");
  const { data: last } = await db
    .from("strategic_plan_goals")
    .select("position")
    .eq("lever_id", input.lever_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("strategic_plan_goals")
    .insert({
      lever_id: input.lever_id,
      text: input.text,
      position: ((last?.position as number | undefined) ?? 0) + 1,
      created_by: viewer.profileId,
      updated_by: viewer.profileId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[${LOG}] nova meta:`, error);
    throw new Pe27HttpError("Não foi possível criar a meta.", 500, "INSERT_FAILED");
  }
  return data.id as string;
}

export async function deleteGoal(id: string): Promise<void> {
  const db = createPe27AdminClient();
  await requirePe27Editor(db);
  const { data, error } = await db.from("strategic_plan_goals").select("id, original_text").eq("id", id).maybeSingle();
  if (error || !data) throw new Pe27HttpError("Meta não encontrada.", 404, "NOT_FOUND");
  if (data.original_text !== null) {
    throw new Pe27HttpError("Metas do workshop não se apagam: marque como descartada.", 400, "WORKSHOP_ITEM");
  }
  const { error: deleteError } = await db.from("strategic_plan_goals").delete().eq("id", id);
  if (deleteError) {
    console.error(`[${LOG}] apagar meta:`, deleteError);
    throw new Pe27HttpError("Não foi possível apagar a meta.", 500, "DELETE_FAILED");
  }
}
