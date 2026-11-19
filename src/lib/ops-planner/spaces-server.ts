import "server-only";

import { z } from "zod";
import { canManageSpace, roleInSpace } from "./domain";
import { dbFail, getOpsDb, LIST_SELECT, OpsPlannerHttpError, SPACE_SELECT, type OpsActor } from "./server";
import { OPS_SPACE_ROLES, type OpsList, type OpsMember, type OpsSpace, type OpsSpaceRole } from "./types";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "Identificador inválido.");

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new OpsPlannerHttpError(result.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID");
  }
  return result.data;
}

function assertManager(actor: OpsActor, spaceId: string): void {
  if (!canManageSpace(actor, spaceId)) {
    throw new OpsPlannerHttpError("Só a liderança do espaço pode alterar isso.", 403, "FORBIDDEN");
  }
}

/** Só gestor (ou admin) dá ou tira o papel de gestor. */
function assertCanTouchRole(actor: OpsActor, spaceId: string, role: OpsSpaceRole | null): void {
  if (role !== "gestor") return;
  if (actor.isAdmin || roleInSpace(actor, spaceId) === "gestor") return;
  throw new OpsPlannerHttpError("Só um gestor pode alterar outro gestor.", 403, "FORBIDDEN");
}

export async function updateSpace(actor: OpsActor, spaceId: string, input: unknown): Promise<OpsSpace> {
  assertManager(actor, spaceId);
  const body = parse(
    z
      .object({
        description: z.string().trim().max(500).nullable().optional(),
        wip_limit: z.number().int().min(1).max(20).optional(),
      })
      .strict(),
    input
  );
  const { data, error } = await getOpsDb().from("ops_spaces").update(body).eq("id", spaceId).select(SPACE_SELECT).single();
  if (error || !data) dbFail("salvar o espaço", error);
  return data as OpsSpace;
}

const memberSchema = z.object({ user_id: id, role: z.enum(OPS_SPACE_ROLES).default("membro") });

export async function addMember(actor: OpsActor, spaceId: string, input: unknown): Promise<OpsMember> {
  assertManager(actor, spaceId);
  const body = parse(memberSchema, input);
  assertCanTouchRole(actor, spaceId, body.role);
  const db = getOpsDb();
  const { data: user } = await db.from("users").select("id, is_active").eq("id", body.user_id).maybeSingle();
  if (!user || user.is_active === false) throw new OpsPlannerHttpError("Pessoa não encontrada ou inativa.", 400, "INVALID_USER");
  const { data, error } = await db
    .from("ops_space_members")
    .upsert({ space_id: spaceId, user_id: body.user_id, role: body.role }, { onConflict: "space_id,user_id" })
    .select("space_id, user_id, role")
    .single();
  if (error || !data) dbFail("adicionar a pessoa ao espaço", error);
  return data as OpsMember;
}

async function currentRole(spaceId: string, userId: string): Promise<OpsSpaceRole> {
  const { data, error } = await getOpsDb()
    .from("ops_space_members")
    .select("role")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) dbFail("carregar o membro", error);
  if (!data) throw new OpsPlannerHttpError("Essa pessoa não está no espaço.", 404, "NOT_FOUND");
  return data.role as OpsSpaceRole;
}

export async function updateMemberRole(actor: OpsActor, spaceId: string, userId: string, input: unknown): Promise<OpsMember> {
  assertManager(actor, spaceId);
  const { role } = parse(z.object({ role: z.enum(OPS_SPACE_ROLES) }), input);
  assertCanTouchRole(actor, spaceId, await currentRole(spaceId, userId));
  assertCanTouchRole(actor, spaceId, role);
  const { data, error } = await getOpsDb()
    .from("ops_space_members")
    .update({ role })
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .select("space_id, user_id, role")
    .single();
  if (error || !data) dbFail("alterar o papel", error);
  return data as OpsMember;
}

export async function removeMember(actor: OpsActor, spaceId: string, userId: string): Promise<void> {
  assertManager(actor, spaceId);
  assertCanTouchRole(actor, spaceId, await currentRole(spaceId, userId));
  const { error } = await getOpsDb().from("ops_space_members").delete().eq("space_id", spaceId).eq("user_id", userId);
  if (error) dbFail("remover a pessoa do espaço", error);
}

const listName = z.string().trim().min(1, "Dê um nome para a lista.").max(80, "Nome muito longo.");

export async function createList(actor: OpsActor, spaceId: string, input: unknown): Promise<OpsList> {
  assertManager(actor, spaceId);
  const { name } = parse(z.object({ name: listName }), input);
  const db = getOpsDb();
  const { data: last } = await db
    .from("ops_lists")
    .select("sort_order")
    .eq("space_id", spaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("ops_lists")
    .insert({ space_id: spaceId, name, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 })
    .select(LIST_SELECT)
    .single();
  if (error?.code === "23505") throw new OpsPlannerHttpError("Já existe uma lista com esse nome.", 409, "DUPLICATE");
  if (error || !data) dbFail("criar a lista", error);
  return data as OpsList;
}

async function loadList(listId: string): Promise<OpsList> {
  const { data, error } = await getOpsDb().from("ops_lists").select(LIST_SELECT).eq("id", listId).is("archived_at", null).maybeSingle();
  if (error) dbFail("carregar a lista", error);
  if (!data) throw new OpsPlannerHttpError("Lista não encontrada.", 404, "NOT_FOUND");
  return data as OpsList;
}

export async function renameList(actor: OpsActor, listId: string, input: unknown): Promise<OpsList> {
  const list = await loadList(listId);
  assertManager(actor, list.space_id);
  const { name } = parse(z.object({ name: listName }), input);
  const { data, error } = await getOpsDb().from("ops_lists").update({ name }).eq("id", listId).select(LIST_SELECT).single();
  if (error?.code === "23505") throw new OpsPlannerHttpError("Já existe uma lista com esse nome.", 409, "DUPLICATE");
  if (error || !data) dbFail("renomear a lista", error);
  return data as OpsList;
}

/** Arquivar a lista deixa as tarefas dela "sem lista" no mesmo espaço. */
export async function archiveList(actor: OpsActor, listId: string): Promise<void> {
  const list = await loadList(listId);
  assertManager(actor, list.space_id);
  const db = getOpsDb();
  const { error: tasksError } = await db.from("ops_tasks").update({ list_id: null }).eq("list_id", listId);
  if (tasksError) dbFail("liberar as tarefas da lista", tasksError);
  const { error: routinesError } = await db.from("ops_routines").update({ list_id: null }).eq("list_id", listId);
  if (routinesError) dbFail("liberar as rotinas da lista", routinesError);
  const { error } = await db.from("ops_lists").update({ archived_at: new Date().toISOString() }).eq("id", listId);
  if (error) dbFail("arquivar a lista", error);
}
