import "server-only";

import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";
import { isSystemEmailConfigured, sendSystemEmail } from "@/lib/system-email";
import { buildDailyNotifications, buildDigest, isDigestEmpty, type AlertTask } from "./alerts";
import { loadEhDiaUtil } from "./business-days-server";
import { renderDigestEmail } from "./digest-email";
import { todayInSaoPaulo } from "./domain";
import { insertNotifications } from "./notifications-server";
import { buildAlertContext, generateRoutineTasks, listActiveRoutines } from "./routines-server";
import { dbFail, getOpsDb, loadPeople } from "./server";

export interface DailyJobResult {
  today: string;
  businessDay: boolean;
  dryRun: boolean;
  generated: number;
  notifications: number;
  emails: { sent: number; skipped: number; failed: number; configured: boolean };
  /** No dryRun: amostra do que seria feito, para conferir. */
  preview?: {
    generated: Array<{ title: string; due_date: string | null }>;
    notifications: Array<{ recipient: string; kind: string; title: string }>;
    emails: Array<{ to: string; subject: string }>;
  };
}

/**
 * Rodada diária do Planner (cron às 07h de Brasília):
 * 1. gera as tarefas das rotinas que entraram na antecedência;
 * 2. grava os avisos do dia (vence hoje/amanhã, atrasada, escaladas);
 * 3. em dia útil, manda o resumo por e-mail para quem tem algo pendente.
 */
export async function runOpsPlannerDaily(options: { dryRun?: boolean; now?: Date } = {}): Promise<DailyJobResult> {
  const dryRun = Boolean(options.dryRun);
  const today = todayInSaoPaulo(options.now);
  const ehDiaUtil = await loadEhDiaUtil();
  const ctx = await buildAlertContext(today, ehDiaUtil);
  const db = getOpsDb();

  const generated = await generateRoutineTasks(await listActiveRoutines(), { today, ehDiaUtil, dryRun, alert: ctx });

  const { data: openRows, error } = await db
    .from("ops_tasks")
    .select("id, space_id, title, status, due_date, assignee_ids, waiting_on, waiting_since, routine_id")
    .is("archived_at", null)
    .in("status", ["a_fazer", "em_andamento", "aguardando"])
    .limit(10000);
  if (error) dbFail("carregar as tarefas abertas", error);
  const openTasks = [...((openRows ?? []) as AlertTask[])];
  // No dryRun as tarefas geradas não estão no banco: entram na conta assim mesmo.
  if (dryRun) openTasks.push(...(generated as AlertTask[]));

  const daily = buildDailyNotifications(openTasks, ctx);
  const notifications = dryRun ? daily.length : await insertNotifications(daily);

  const businessDay = ehDiaUtil(today);
  const emails = { sent: 0, skipped: 0, failed: 0, configured: isSystemEmailConfigured() };
  const emailPreview: Array<{ to: string; subject: string }> = [];

  if (businessDay) {
    const [people, membersResult, prefsResult] = await Promise.all([
      loadPeople(),
      db.from("ops_space_members").select("space_id, user_id, role"),
      db.from("ops_notification_prefs").select("user_id, email_digest, manager_digest, last_digest_on"),
    ]);
    if (membersResult.error) dbFail("carregar os membros", membersResult.error);
    if (prefsResult.error) dbFail("carregar as preferências de aviso", prefsResult.error);
    const prefs = new Map((prefsResult.data ?? []).map((row) => [row.user_id as string, row]));
    const managed = new Map<string, string[]>();
    for (const member of membersResult.data ?? []) {
      if (member.role !== "lider" && member.role !== "gestor") continue;
      managed.set(member.user_id as string, [...(managed.get(member.user_id as string) ?? []), member.space_id as string]);
    }
    const recipients = new Set<string>([
      ...(membersResult.data ?? []).map((member) => member.user_id as string),
      ...openTasks.flatMap((task) => task.assignee_ids),
    ]);
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || PUBLIC_APP_ORIGIN).replace(/\/$/, "");

    for (const userId of recipients) {
      const person = people.find((item) => item.id === userId);
      const pref = prefs.get(userId);
      if (!person?.email || !person.is_active || pref?.email_digest === false || pref?.last_digest_on === today) {
        emails.skipped += 1;
        continue;
      }
      const digest = buildDigest(userId, openTasks, pref?.manager_digest === false ? [] : managed.get(userId) ?? [], ctx);
      if (isDigestEmpty(digest)) {
        emails.skipped += 1;
        continue;
      }
      const email = renderDigestEmail(digest, { name: person.name, baseUrl, today });
      if (dryRun || !emails.configured) {
        emailPreview.push({ to: person.email, subject: email.subject });
        if (!dryRun) emails.skipped += 1;
        continue;
      }
      try {
        await sendSystemEmail({ to: person.email, subject: email.subject, html: email.html, text: email.text });
        await db
          .from("ops_notification_prefs")
          .upsert(
            { user_id: userId, email_digest: pref?.email_digest ?? true, manager_digest: pref?.manager_digest ?? true, last_digest_on: today },
            { onConflict: "user_id" }
          );
        emails.sent += 1;
      } catch (cause) {
        console.error("[ops-planner] resumo por e-mail", person.email, cause);
        emails.failed += 1;
      }
    }
  }

  const result: DailyJobResult = {
    today,
    businessDay,
    dryRun,
    generated: generated.length,
    notifications,
    emails,
  };
  if (dryRun) {
    const names = new Map((await loadPeople()).map((person) => [person.id, person.name]));
    result.preview = {
      generated: generated.slice(0, 50).map((task) => ({ title: task.title, due_date: task.due_date })),
      notifications: daily.slice(0, 100).map((item) => ({ recipient: names.get(item.recipient_id) ?? item.recipient_id, kind: item.kind, title: item.title })),
      emails: emailPreview,
    };
  }
  return result;
}
