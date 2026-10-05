import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { hasHrAccess } from "@/lib/rh/access";
import { RhHttpError, toRhApiError } from "@/lib/rh/qualifications/server";
import type { HrOnboardingNotification } from "@/lib/ferias/types";
import { suggestRegistrationMatches, type MatchCandidate } from "@/lib/rh/registration/matching";
import { coerceRegistrationAnswers } from "@/lib/rh/registration/types";

export { RhHttpError, toRhApiError };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const NOTIFICATION_SELECT =
  "id, employee_id, registration_form_id, event_type, previous_is_active, new_is_active, created_at, resolved_at, employee:hr_employees(full_name, department, position), registration_form:hr_registration_forms(invitee_name, employment_kind)";

function createHrNotificationsAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new RhHttpError(
      "SUPABASE_SERVICE_ROLE_KEY não configurada.",
      503,
      "SERVICE_UNAVAILABLE"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

interface NotificationRecipient {
  profileId: string;
}

/** Andressa/Catharina (flag dedicada) ou quem tiver acesso ao módulo de RH; admins entram via hasHrAccess. */
async function requireNotificationRecipient(): Promise<NotificationRecipient> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const admin = createHrNotificationsAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role, permissions, is_hr_notification_recipient")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error || !data) {
    throw new RhHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  }

  const role = (data.role as string | null) ?? null;
  const permissions = (data.permissions as string[] | null) ?? [];
  const isRecipient = Boolean(data.is_hr_notification_recipient) || hasHrAccess(role, permissions);
  if (!isRecipient) {
    throw new RhHttpError("Você não recebe notificações de RH.", 403, "FORBIDDEN");
  }

  return { profileId: data.id as string };
}

export async function listPendingHrNotifications(): Promise<HrOnboardingNotification[]> {
  await requireNotificationRecipient();
  const admin = createHrNotificationsAdminClient();

  const { data, error } = await admin
    .from("hr_onboarding_notifications")
    .select(NOTIFICATION_SELECT)
    .is("resolved_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new RhHttpError("Falha ao carregar notificações.", 500, "QUERY_FAILED");
  const notifications = ((data ?? []) as unknown as HrOnboardingNotification[]).map((row) => ({
    ...row,
    registration_form: Array.isArray(row.registration_form)
      ? (row.registration_form[0] ?? null)
      : row.registration_form,
    registration_suggestion: null,
  }));
  return attachRegistrationSuggestions(admin, notifications);
}

/**
 * Para cada colaborador novo vindo do VIOS, procura uma ficha cadastral já
 * respondida e ainda sem vínculo que pareça ser da mesma pessoa. A RH confirma
 * com um clique na notificação — nunca vinculamos sozinhos.
 */
async function attachRegistrationSuggestions(
  admin: SupabaseClient,
  notifications: HrOnboardingNotification[]
): Promise<HrOnboardingNotification[]> {
  const employeeIds = notifications
    .filter((item) => item.event_type === "new_employee" && item.employee_id)
    .map((item) => item.employee_id as string);
  if (employeeIds.length === 0) return notifications;

  const [{ data: forms }, { data: employees }] = await Promise.all([
    admin
      .from("hr_registration_forms")
      .select("id, invitee_name, answers")
      .in("status", ["recebida", "aprovada"])
      .is("employee_id", null),
    admin
      .from("hr_employees")
      .select("id, full_name, cpf, department, position")
      .in("id", employeeIds),
  ]);
  if (!forms?.length || !employees?.length) return notifications;

  const byEmployee = new Map<string, HrOnboardingNotification["registration_suggestion"]>();
  for (const employee of employees as MatchCandidate[]) {
    let best: { form_id: string; name: string; reason: "cpf" | "nome"; score: number } | null = null;
    for (const form of forms) {
      const answers = coerceRegistrationAnswers(form.answers);
      const [match] = suggestRegistrationMatches(
        { names: [form.invitee_name as string, answers.fullName], cpf: answers.cpf },
        [employee]
      );
      if (match && (!best || match.score > best.score)) {
        best = {
          form_id: form.id as string,
          name: answers.fullName || (form.invitee_name as string),
          reason: match.reason,
          score: match.score,
        };
      }
    }
    if (best) byEmployee.set(employee.id, { form_id: best.form_id, name: best.name, reason: best.reason });
  }

  return notifications.map((item) =>
    item.event_type === "new_employee" && item.employee_id && byEmployee.has(item.employee_id)
      ? { ...item, registration_suggestion: byEmployee.get(item.employee_id) ?? null }
      : item
  );
}

export async function resolveHrNotification(notificationId: string): Promise<void> {
  const recipient = await requireNotificationRecipient();
  const admin = createHrNotificationsAdminClient();

  const { error } = await admin
    .from("hr_onboarding_notifications")
    .update({ resolved_at: new Date().toISOString(), resolved_by: recipient.profileId })
    .eq("id", notificationId)
    .is("resolved_at", null);

  if (error) throw new RhHttpError("Falha ao resolver notificação.", 500, "UPDATE_FAILED");
}

/** Chamado a partir de `updateEmployee` (Férias) quando a ficha de um colaborador é salva. */
export async function resolveOpenNotificationsForEmployee(
  admin: SupabaseClient,
  employeeId: string,
  resolvedBy: string
): Promise<void> {
  await admin
    .from("hr_onboarding_notifications")
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq("employee_id", employeeId)
    .is("resolved_at", null);
}
