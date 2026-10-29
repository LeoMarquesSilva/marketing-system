import "server-only";

import type { NewNotification } from "./alerts";
import { todayInSaoPaulo } from "./domain";
import { dbFail, getOpsDb, OpsPlannerHttpError, type OpsActor } from "./server";
import type { OpsNotification, OpsNotificationPrefs } from "./types";

const NOTIFICATION_SELECT = "id, recipient_id, task_id, routine_id, kind, title, body, created_at, read_at";

/** Grava avisos; os que têm dedupe_key já gravada são ignorados. Retorna quantos entraram. */
export async function insertNotifications(
  rows: Array<Omit<NewNotification, "dedupe_key"> & { dedupe_key: string | null }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getOpsDb();
  const withKey = rows.filter((row) => row.dedupe_key);
  const withoutKey = rows.filter((row) => !row.dedupe_key);
  let inserted = 0;
  for (let i = 0; i < withKey.length; i += 500) {
    const { data, error } = await db
      .from("ops_notifications")
      .upsert(withKey.slice(i, i + 500), { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) dbFail("gravar os avisos", error);
    inserted += data?.length ?? 0;
  }
  if (withoutKey.length > 0) {
    const { error } = await db.from("ops_notifications").insert(withoutKey);
    if (error) dbFail("gravar os avisos", error);
    inserted += withoutKey.length;
  }
  return inserted;
}

export async function listMyNotifications(actor: OpsActor): Promise<{ items: OpsNotification[]; unread: number }> {
  const db = getOpsDb();
  const [items, unread] = await Promise.all([
    db
      .from("ops_notifications")
      .select(NOTIFICATION_SELECT)
      .eq("recipient_id", actor.userId)
      .order("created_at", { ascending: false })
      .limit(60),
    db
      .from("ops_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", actor.userId)
      .is("read_at", null),
  ]);
  if (items.error) dbFail("carregar os avisos", items.error);
  if (unread.error) dbFail("contar os avisos", unread.error);
  return { items: (items.data ?? []) as OpsNotification[], unread: unread.count ?? 0 };
}

export async function markNotificationsRead(actor: OpsActor, ids: string[] | "all"): Promise<void> {
  let query = getOpsDb()
    .from("ops_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", actor.userId)
    .is("read_at", null);
  if (ids !== "all") {
    if (ids.length === 0) return;
    query = query.in("id", ids.slice(0, 200));
  }
  const { error } = await query;
  if (error) dbFail("marcar os avisos como lidos", error);
}

/** Número do badge do menu: tarefas minhas atrasadas ou que vencem hoje. */
export async function countMyDueTasks(actor: OpsActor): Promise<number> {
  const { count, error } = await getOpsDb()
    .from("ops_tasks")
    .select("id", { count: "exact", head: true })
    .contains("assignee_ids", [actor.userId])
    .is("archived_at", null)
    .in("status", ["a_fazer", "em_andamento", "aguardando"])
    .lte("due_date", todayInSaoPaulo());
  if (error) dbFail("contar as tarefas do dia", error);
  return count ?? 0;
}

export async function getMyPrefs(actor: OpsActor): Promise<OpsNotificationPrefs> {
  const { data, error } = await getOpsDb()
    .from("ops_notification_prefs")
    .select("email_digest, manager_digest")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (error) dbFail("carregar as preferências de aviso", error);
  return {
    email_digest: data?.email_digest ?? true,
    manager_digest: data?.manager_digest ?? true,
  };
}

export async function updateMyPrefs(actor: OpsActor, input: unknown): Promise<OpsNotificationPrefs> {
  const body = (input ?? {}) as Partial<OpsNotificationPrefs>;
  if (
    (body.email_digest !== undefined && typeof body.email_digest !== "boolean") ||
    (body.manager_digest !== undefined && typeof body.manager_digest !== "boolean")
  ) {
    throw new OpsPlannerHttpError("Preferência inválida.", 400, "INVALID");
  }
  const current = await getMyPrefs(actor);
  const next = { ...current, ...body };
  const { error } = await getOpsDb()
    .from("ops_notification_prefs")
    .upsert({ user_id: actor.userId, email_digest: next.email_digest, manager_digest: next.manager_digest }, { onConflict: "user_id" });
  if (error) dbFail("salvar as preferências de aviso", error);
  return next;
}
