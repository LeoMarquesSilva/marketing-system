import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { enviarEmailMicrosoft, microsoftMailConfigurado } from "@/lib/microsoft-mail";
import { loadPeopleDirectory } from "@/lib/rh/people-directory";
import { corporateEmail } from "@/lib/rh/welcome/corporate-email";
import { buildNotificationEmail } from "./email";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { createRhServiceClient, toPerson } from "@/lib/rh/team-context";
import type { AppNotification } from "@/lib/rh/feedback/types";

/**
 * Sino geral do ORQESTRAI: tabela `notifications`, um aviso por pessoa.
 * O feedback é o primeiro a usar; comunicados, 1:1 e PDI entram depois.
 */

export interface NotificationInput {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  actorEmployeeId?: string | null;
  /**
   * Também manda por e-mail (Microsoft 365), quando a configuração do módulo pede.
   * Só o aviso e o botão: o conteúdo fica no sistema.
   */
  email?: { intro: string; button?: string } | null;
}

/** Avisa colaboradores (pelo cadastro); quem não tem acesso ao sistema é ignorado. */
export async function notifyEmployees(db: SupabaseClient, employeeIds: string[], input: NotificationInput): Promise<void> {
  const ids = [...new Set(employeeIds.filter(Boolean))];
  if (!ids.length) return;
  const { data, error } = await db.from("hr_employees").select("id, user_id, full_name").in("id", ids);
  if (error) {
    console.error("[avisos] colaboradores:", error);
    return;
  }
  const rows = (data ?? [])
    .filter((row) => row.user_id)
    .map((row) => ({
      user_id: row.user_id as string,
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: input.body ? input.body.slice(0, 500) : null,
      link: input.link ?? null,
      actor_employee_id: input.actorEmployeeId ?? null,
    }));
  if (!rows.length) return;
  const { error: insertError } = await db.from("notifications").insert(rows);
  // Aviso que não sai não pode derrubar a ação principal (o feedback já foi gravado).
  if (insertError) console.error("[avisos] gravar:", insertError);
  if (input.email && input.link) {
    await emailEmployees(
      db,
      (data ?? []).filter((row) => row.user_id).map((row) => ({ userId: row.user_id as string, name: (row.full_name as string | null) ?? "" })),
      { title: input.title, link: input.link, ...input.email },
    );
  }
}

/** Envio por e-mail de um aviso; falha só vai para o log (o aviso no sino já foi gravado). */
async function emailEmployees(
  db: SupabaseClient,
  people: Array<{ userId: string; name: string }>,
  message: { title: string; link: string; intro: string; button?: string },
): Promise<void> {
  if (!people.length) return;
  if (!microsoftMailConfigurado()) {
    console.error("[avisos] e-mail ligado, mas o Microsoft 365 não está configurado.");
    return;
  }
  const { data, error } = await db.from("users").select("id, email").in("id", people.map((person) => person.userId));
  if (error) {
    console.error("[avisos] e-mails:", error);
    return;
  }
  const emailByUser = new Map((data ?? []).map((row) => [row.id as string, corporateEmail(row.email as string | null)]));
  await Promise.all(
    people.map(async (person) => {
      const to = emailByUser.get(person.userId);
      if (!to) return;
      const { subject, html } = buildNotificationEmail({ recipientName: person.name, title: message.title, intro: message.intro, link: message.link, button: message.button });
      try {
        await enviarEmailMicrosoft({ para: to, assunto: subject, html });
      } catch (sendError) {
        console.error("[avisos] enviar e-mail:", sendError);
      }
    }),
  );
}

export async function currentUser(): Promise<{ db: SupabaseClient; userId: string }> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Não autenticado.", 401, "UNAUTHENTICATED");
  const db = createRhServiceClient();
  const { data, error } = await db.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error || !data) throw new RhHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  return { db, userId: data.id as string };
}

export async function unreadCount(db: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  if (error) {
    console.error("[avisos] contar:", error);
    return 0;
  }
  return count ?? 0;
}

export async function listNotifications(db: SupabaseClient, userId: string, limit = 40): Promise<AppNotification[]> {
  const { data, error } = await db
    .from("notifications")
    .select("id, kind, title, body, link, actor_employee_id, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[avisos] listar:", error);
    throw new RhHttpError("Falha ao carregar os avisos.", 500, "QUERY_FAILED");
  }
  const rows = data ?? [];
  const actorIds = new Set(rows.map((row) => row.actor_employee_id as string | null).filter(Boolean) as string[]);
  const people = actorIds.size ? new Map((await loadPeopleDirectory(db, "avisos")).filter((p) => actorIds.has(p.id)).map((p) => [p.id, toPerson(p)])) : new Map();
  return rows.map((row) => ({
    id: row.id as string,
    kind: row.kind as string,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    link: (row.link as string | null) ?? null,
    actor: row.actor_employee_id ? people.get(row.actor_employee_id as string) ?? null : null,
    read_at: (row.read_at as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function markNotificationsRead(db: SupabaseClient, userId: string, ids: string[] | null): Promise<void> {
  let query = db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (ids) query = query.in("id", ids);
  const { error } = await query;
  if (error) {
    console.error("[avisos] marcar lidos:", error);
    throw new RhHttpError("Falha ao marcar os avisos.", 500, "QUERY_FAILED");
  }
}
