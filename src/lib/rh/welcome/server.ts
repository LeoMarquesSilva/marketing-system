import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { enviarEmailMicrosoft, microsoftMailConfigurado } from "@/lib/microsoft-mail";
import {
  createRegistrationAdminClient,
  requireRegistrationManager,
  RhHttpError,
} from "@/lib/rh/registration/server";
import { firstAccessLink, generateSetupToken, hashSetupToken } from "@/lib/account-setup-token";
import {
  audienceFromDepartment,
  audienceFromPlacement,
  groupLinksByAudience,
  isAudienceKey,
  linksForAudience,
} from "./audience";
import { buildWelcomeEmail } from "./email";
import {
  WELCOME_EMPLOYMENT_TYPES,
  WELCOME_INTRO_DAYS,
  WELCOME_QUEUE_START,
  WELCOME_SETUP_VALIDITY_DAYS,
  type CompleteOnboardingInput,
  type MyWelcomeLinks,
  type WelcomeEmployee,
  type WelcomeLink,
  type WelcomeLinkInput,
  type WelcomeLoginState,
  type WelcomeOverview,
  type WelcomeRecord,
} from "./types";

/**
 * Boas-vindas de colaborador novo. Quem dispara é o RH (mesmo acesso das
 * fichas cadastrais): concluir o onboarding cria o acesso ao ORQESTRAI, sem
 * senha padrão, e envia pelo Microsoft 365 um e-mail curto com o botão de
 * acesso. Os links da área ficam em Meus links.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK_SELECT = "id, title, url, description, internal_note, audience, sort_order, is_active";

type LinkRow = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  internal_note: string | null;
  audience: string;
  sort_order: number;
  is_active: boolean;
};

type CompletionRow = {
  employee_id: string;
  completed_at: string;
  completed_by: string | null;
  audience_key: string | null;
  email_to: string | null;
  email_sent_at: string | null;
  email_send_count: number;
  last_sent_by: string | null;
  last_error: string | null;
};

type EmployeeRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  employment_type: string | null;
  admission_date: string | null;
  created_at: string;
  is_active: boolean;
};

const EMPLOYEE_SELECT =
  "id, user_id, full_name, email, department, position, employment_type, admission_date, created_at, is_active";

function toLink(row: LinkRow): WelcomeLink {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    internalNote: row.internal_note,
    audience: row.audience,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

async function loadLinks(admin: SupabaseClient, onlyActive = false): Promise<WelcomeLink[]> {
  let query = admin.from("hr_welcome_links").select(LINK_SELECT).order("sort_order");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new RhHttpError("Não foi possível carregar os links de boas-vindas.", 500, "QUERY_FAILED");
  return ((data ?? []) as LinkRow[]).map(toLink);
}

/** Equipe (ou divisão) de cada colaborador no organograma; comitês não contam. */
async function loadPlacements(admin: SupabaseClient, employeeIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (employeeIds.length === 0) return result;
  const { data, error } = await admin
    .from("org_chart_members")
    .select("employee_id, placement, division_key, team_key")
    .in("employee_id", employeeIds)
    .in("placement", ["team", "division_leader"]);
  if (error) throw new RhHttpError("Não foi possível ler o organograma.", 500, "QUERY_FAILED");
  for (const row of data ?? []) {
    const key = audienceFromPlacement(row.division_key as string | null, row.team_key as string | null);
    // Equipe vence a liderança de divisão quando a pessoa aparece nas duas.
    if (key && (!result.has(row.employee_id as string) || row.placement === "team")) {
      result.set(row.employee_id as string, key);
    }
  }
  return result;
}

/** Último login de cada conta do Supabase Auth, pelo id do Auth. */
async function loadLastSignIns(admin: SupabaseClient): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new RhHttpError("Não foi possível consultar os logins.", 500, "AUTH_LOOKUP_FAILED");
    for (const user of data.users) result.set(user.id, user.last_sign_in_at ?? null);
    if (data.users.length < 1000) break;
  }
  return result;
}

async function loadUserNames(admin: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const { data } = await admin.from("users").select("id, name").in("id", unique);
  for (const row of data ?? []) result.set(row.id as string, row.name as string);
  return result;
}

function toRecord(row: CompletionRow, names: Map<string, string>): WelcomeRecord {
  return {
    completedAt: row.completed_at,
    completedByName: row.completed_by ? (names.get(row.completed_by) ?? null) : null,
    audienceKey: row.audience_key,
    emailTo: row.email_to,
    emailSentAt: row.email_sent_at,
    emailSendCount: row.email_send_count,
    lastSentByName: row.last_sent_by ? (names.get(row.last_sent_by) ?? null) : null,
    lastError: row.last_error,
  };
}

function isInQueue(employee: EmployeeRow): boolean {
  const admission = employee.admission_date ?? "";
  return admission >= WELCOME_QUEUE_START || employee.created_at.slice(0, 10) >= WELCOME_QUEUE_START;
}

// ─── Visão do RH ─────────────────────────────────────────────────────────────

export async function getWelcomeOverview(): Promise<WelcomeOverview> {
  await requireRegistrationManager();
  const admin = createRegistrationAdminClient();

  const [links, employeesResult, completionsResult] = await Promise.all([
    loadLinks(admin),
    admin.from("hr_employees").select(EMPLOYEE_SELECT).eq("is_active", true).order("full_name"),
    admin.from("hr_onboarding_completions").select("*"),
  ]);
  if (employeesResult.error) throw new RhHttpError("Falha ao carregar os colaboradores.", 500, "QUERY_FAILED");
  if (completionsResult.error) throw new RhHttpError("Falha ao carregar as boas-vindas.", 500, "QUERY_FAILED");

  const employees = (employeesResult.data ?? []) as EmployeeRow[];
  const completions = new Map(
    ((completionsResult.data ?? []) as CompletionRow[]).map((row) => [row.employee_id, row])
  );
  const userIds = employees.map((row) => row.user_id).filter((id): id is string => !!id);

  const [placements, usersResult, lastSignIns, names] = await Promise.all([
    loadPlacements(
      admin,
      employees.map((row) => row.id)
    ),
    userIds.length
      ? admin.from("users").select("id, auth_id, avatar_url, photo_onedrive_url").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    loadLastSignIns(admin),
    loadUserNames(
      admin,
      [...completions.values()].flatMap((row) => [row.completed_by ?? "", row.last_sent_by ?? ""])
    ),
  ]);
  if (usersResult.error) throw new RhHttpError("Falha ao carregar os usuários.", 500, "QUERY_FAILED");
  const users = new Map(
    (usersResult.data ?? []).map((row) => [
      row.id as string,
      {
        authId: (row.auth_id as string | null) ?? null,
        avatarUrl: resolveEmployeeAvatarUrl(row.avatar_url as string | null, row.photo_onedrive_url as string | null),
      },
    ])
  );

  const result: WelcomeEmployee[] = employees.map((employee) => {
    const user = employee.user_id ? users.get(employee.user_id) : undefined;
    const lastSignInAt = user?.authId ? (lastSignIns.get(user.authId) ?? null) : null;
    const loginState: WelcomeLoginState = !user?.authId ? "sem_login" : lastSignInAt ? "ja_entrou" : "nunca_entrou";
    const completion = completions.get(employee.id);
    return {
      employeeId: employee.id,
      fullName: employee.full_name,
      email: employee.email,
      avatarUrl: user?.avatarUrl ?? null,
      department: employee.department,
      position: employee.position,
      employmentType: employee.employment_type,
      admissionDate: employee.admission_date,
      suggestedAudience: placements.get(employee.id) ?? audienceFromDepartment(employee.department),
      placedInOrgChart: placements.has(employee.id),
      loginState,
      lastSignInAt,
      inQueue: isInQueue(employee),
      record: completion ? toRecord(completion, names) : null,
    };
  });

  return { links, employees: result };
}

// ─── Concluir onboarding e enviar o e-mail ───────────────────────────────────

interface Actor {
  id: string;
  name: string | null;
  email: string | null;
}

async function loadActor(admin: SupabaseClient, profileId: string): Promise<Actor> {
  const { data } = await admin.from("users").select("id, name, email").eq("id", profileId).maybeSingle();
  return {
    id: profileId,
    name: (data?.name as string | null) ?? null,
    email: (data?.email as string | null) ?? null,
  };
}

/** Usuário do colaborador: o já vinculado, um sem ficha com o mesmo e-mail ou um novo. */
async function ensureUserRow(admin: SupabaseClient, employee: EmployeeRow, email: string): Promise<string> {
  if (employee.user_id) return employee.user_id;

  const { data: existing, error } = await admin
    .from("users")
    .select("id")
    .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle();
  if (error) throw new RhHttpError("Não foi possível verificar o usuário.", 500, "QUERY_FAILED");

  let userId: string | null = null;
  if (existing) {
    const { data: owner } = await admin
      .from("hr_employees")
      .select("id")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (owner && owner.id !== employee.id) {
      throw new RhHttpError(
        "Este e-mail já pertence ao usuário de outro colaborador. Confira o e-mail corporativo.",
        409,
        "EMAIL_IN_USE"
      );
    }
    userId = existing.id as string;
  } else {
    const { data: created, error: createError } = await admin
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        name: employee.full_name,
        email,
        department: employee.department,
        is_active: true,
      })
      .select("id")
      .single();
    if (createError || !created) throw new RhHttpError("Não foi possível criar o usuário.", 500, "INSERT_FAILED");
    userId = created.id as string;
  }

  const { error: linkError } = await admin.from("hr_employees").update({ user_id: userId }).eq("id", employee.id);
  if (linkError) throw new RhHttpError("Não foi possível vincular o usuário à ficha.", 500, "UPDATE_FAILED");
  return userId;
}

async function findAuthUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Login no Supabase Auth sem senha: a pessoa cria a dela pelo link do e-mail. */
async function ensureAuthUser(admin: SupabaseClient, userId: string, email: string): Promise<string> {
  const { data: user, error } = await admin.from("users").select("id, auth_id").eq("id", userId).single();
  if (error || !user) throw new RhHttpError("Usuário não encontrado.", 404, "NOT_FOUND");
  if (user.auth_id) return user.auth_id as string;

  let authId: string | null = null;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created?.user) {
    authId = created.user.id;
  } else {
    // Conta do Auth que sobrou sem usuário (ex.: cadastro antigo): reaproveita se ninguém a usa.
    const orphan = /already|registered|exists/i.test(createError?.message ?? "")
      ? await findAuthUserIdByEmail(admin, email)
      : null;
    if (orphan) {
      const { data: owner } = await admin.from("users").select("id").eq("auth_id", orphan).maybeSingle();
      if (!owner) authId = orphan;
    }
  }
  if (!authId) {
    console.error("[boas-vindas] createUser:", createError);
    throw new RhHttpError(
      "Não foi possível criar o login deste e-mail. Peça ao administrador para conferir em Usuários.",
      500,
      "AUTH_CREATE_FAILED"
    );
  }

  const { error: linkError } = await admin
    .from("users")
    .update({ auth_id: authId, email, is_active: true, must_change_password: false })
    .eq("id", userId);
  if (linkError) throw new RhHttpError("Não foi possível vincular o login ao usuário.", 500, "UPDATE_FAILED");
  return authId;
}

async function createSetupLink(admin: SupabaseClient, userId: string, actorId: string, origin: string): Promise<string> {
  const now = new Date();
  // Um link novo substitui os anteriores ainda não usados.
  await admin
    .from("account_setup_tokens")
    .update({ used_at: now.toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);
  const token = generateSetupToken();
  const { error } = await admin.from("account_setup_tokens").insert({
    user_id: userId,
    token_hash: hashSetupToken(token),
    expires_at: new Date(now.getTime() + WELCOME_SETUP_VALIDITY_DAYS * 86_400_000).toISOString(),
    created_by: actorId,
  });
  if (error) throw new RhHttpError("Não foi possível gerar o link de primeiro acesso.", 500, "INSERT_FAILED");
  return firstAccessLink(origin, token);
}

export interface CompleteOnboardingResult {
  employee: WelcomeEmployee;
  sent: boolean;
  error: string | null;
}

/**
 * Conclui o onboarding (ou reenvia, se já concluído): salva o vínculo que
 * faltava, garante usuário e login, gera o link de primeiro acesso (se a pessoa
 * nunca entrou) e envia o e-mail. Se o envio falhar, a conclusão fica
 * registrada com o erro, para o RH reenviar.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput,
  origin: string
): Promise<CompleteOnboardingResult> {
  const manager = await requireRegistrationManager();
  const admin = createRegistrationAdminClient();
  const actor = await loadActor(admin, manager.profileId);

  const { data: employeeData, error: employeeError } = await admin
    .from("hr_employees")
    .select(EMPLOYEE_SELECT)
    .eq("id", input.employeeId)
    .maybeSingle();
  if (employeeError) throw new RhHttpError("Não foi possível carregar o colaborador.", 500, "QUERY_FAILED");
  const employee = employeeData as EmployeeRow | null;
  if (!employee) throw new RhHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");
  if (!employee.is_active) throw new RhHttpError("O colaborador está inativo no VIOS.", 409, "INACTIVE");

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new RhHttpError("Informe o e-mail corporativo.", 400, "INVALID_EMAIL");

  const employmentType = input.employmentType?.trim() || null;
  if (!employee.employment_type) {
    if (!employmentType || !(WELCOME_EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) {
      throw new RhHttpError("Escolha o vínculo do colaborador.", 400, "EMPLOYMENT_TYPE_REQUIRED");
    }
  }
  const employeeUpdate: Record<string, string> = {};
  if (!employee.employment_type && employmentType) employeeUpdate.employment_type = employmentType;
  if (!employee.email) employeeUpdate.email = email;
  if (Object.keys(employeeUpdate).length) {
    const { error } = await admin.from("hr_employees").update(employeeUpdate).eq("id", employee.id);
    if (error) throw new RhHttpError("Não foi possível salvar o vínculo.", 500, "UPDATE_FAILED");
  }

  const audienceKey = isAudienceKey(input.audienceKey) ? input.audienceKey : null;

  const userId = await ensureUserRow(admin, employee, email);
  const authId = await ensureAuthUser(admin, userId, email);
  const { data: authData } = await admin.auth.admin.getUserById(authId);
  const neverSignedIn = !authData.user?.last_sign_in_at;
  const loginEmail = authData.user?.email ?? email;

  const accessUrl = neverSignedIn
    ? await createSetupLink(admin, userId, actor.id, origin)
    : `${origin.replace(/\/+$/, "")}/meus-links`;
  const { subject, html } = buildWelcomeEmail({
    fullName: employee.full_name,
    loginEmail,
    access: { kind: neverSignedIn ? "setup" : "login", url: accessUrl },
  });

  let sendError: string | null = null;
  if (process.env.NODE_ENV === "development" && !microsoftMailConfigurado()) {
    console.info(`[boas-vindas] Microsoft 365 não configurado; e-mail para ${email} não enviado. Acesso: ${accessUrl}`);
    sendError = "Microsoft 365 não configurado neste ambiente: o e-mail não foi enviado.";
  } else {
    try {
      await enviarEmailMicrosoft({ para: email, assunto: subject, html, responderPara: actor.email });
    } catch (error) {
      console.error("[boas-vindas] falha ao enviar:", error);
      sendError = "O Microsoft 365 não aceitou o envio agora. Tente reenviar em alguns minutos.";
    }
  }

  const now = new Date().toISOString();
  const { data: previous } = await admin
    .from("hr_onboarding_completions")
    .select("*")
    .eq("employee_id", employee.id)
    .maybeSingle();
  const prev = previous as CompletionRow | null;
  const { error: saveError } = await admin.from("hr_onboarding_completions").upsert({
    employee_id: employee.id,
    completed_at: prev?.completed_at ?? now,
    completed_by: prev?.completed_by ?? actor.id,
    audience_key: audienceKey,
    email_to: email,
    email_sent_at: sendError ? (prev?.email_sent_at ?? null) : now,
    email_send_count: (prev?.email_send_count ?? 0) + (sendError ? 0 : 1),
    last_sent_by: sendError ? (prev?.last_sent_by ?? null) : actor.id,
    last_error: sendError,
    updated_at: now,
  });
  if (saveError) throw new RhHttpError("O e-mail saiu, mas não foi possível registrar a conclusão.", 500, "UPSERT_FAILED");

  const overview = await getWelcomeOverview();
  const updated = overview.employees.find((item) => item.employeeId === employee.id);
  if (!updated) throw new RhHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");
  return { employee: updated, sent: !sendError, error: sendError };
}


// ─── Links (mantidos pelo RH) ────────────────────────────────────────────────

function cleanText(value: string | null | undefined, max: number, label: string): string | null {
  const text = value?.trim() ?? "";
  if (!text) return null;
  if (text.length > max) throw new RhHttpError(`${label}: no máximo ${max} caracteres.`, 400, "TOO_LONG");
  return text;
}

export async function saveWelcomeLink(input: WelcomeLinkInput): Promise<WelcomeLink[]> {
  const manager = await requireRegistrationManager();
  const admin = createRegistrationAdminClient();

  const title = cleanText(input.title, 120, "Nome");
  if (!title) throw new RhHttpError("Dê um nome ao link.", 400, "TITLE_REQUIRED");
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    throw new RhHttpError("Endereço inválido. Cole o link completo, começando com https://.", 400, "INVALID_URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new RhHttpError("O endereço precisa começar com https://.", 400, "INVALID_URL");
  }
  if (!isAudienceKey(input.audience)) throw new RhHttpError("Escolha para quem é o link.", 400, "INVALID_AUDIENCE");

  const payload = {
    title,
    url: url.toString(),
    description: cleanText(input.description, 240, "Explicação"),
    internal_note: cleanText(input.internalNote, 240, "Nota interna"),
    audience: input.audience,
    is_active: input.isActive !== false,
    updated_at: new Date().toISOString(),
    updated_by: manager.profileId,
  };

  if (input.id) {
    const { error } = await admin.from("hr_welcome_links").update(payload).eq("id", input.id);
    if (error) throw new RhHttpError("Não foi possível salvar o link.", 500, "UPDATE_FAILED");
  } else {
    const { data: last } = await admin
      .from("hr_welcome_links")
      .select("sort_order")
      .eq("audience", input.audience)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await admin
      .from("hr_welcome_links")
      .insert({ ...payload, sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10 });
    if (error) throw new RhHttpError("Não foi possível criar o link.", 500, "INSERT_FAILED");
  }
  return loadLinks(admin);
}

export async function deleteWelcomeLink(id: string): Promise<WelcomeLink[]> {
  await requireRegistrationManager();
  const admin = createRegistrationAdminClient();
  const { error } = await admin.from("hr_welcome_links").delete().eq("id", id);
  if (error) throw new RhHttpError("Não foi possível excluir o link.", 500, "DELETE_FAILED");
  return loadLinks(admin);
}

/** Sobe ou desce o link dentro do seu público (renumera de 10 em 10). */
export async function moveWelcomeLink(id: string, direction: "up" | "down"): Promise<WelcomeLink[]> {
  await requireRegistrationManager();
  const admin = createRegistrationAdminClient();
  const links = await loadLinks(admin);
  const target = links.find((link) => link.id === id);
  if (!target) throw new RhHttpError("Link não encontrado.", 404, "NOT_FOUND");
  const siblings = groupLinksByAudience(links).find((group) => group.key === target.audience)?.links ?? [];
  const index = siblings.findIndex((link) => link.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return links;
  const reordered = [...siblings];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
  await Promise.all(
    reordered.map((link, position) =>
      admin
        .from("hr_welcome_links")
        .update({ sort_order: (position + 1) * 10 })
        .eq("id", link.id)
    )
  );
  return loadLinks(admin);
}

// ─── Meus links (qualquer pessoa logada) ─────────────────────────────────────

export async function getMyWelcomeLinks(): Promise<MyWelcomeLinks> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const admin = createRegistrationAdminClient();
  const { data: profile } = await admin.from("users").select("id, name").eq("auth_id", user.id).maybeSingle();
  if (!profile) throw new RhHttpError("Usuário não encontrado.", 404, "NOT_FOUND");

  const { data: employee } = await admin
    .from("hr_employees")
    .select("id, full_name, department")
    .eq("user_id", profile.id)
    .maybeSingle();

  let audienceKey: string | null = null;
  let recentWelcome = false;
  if (employee) {
    const [{ data: completion }, placements] = await Promise.all([
      admin
        .from("hr_onboarding_completions")
        .select("audience_key, completed_at")
        .eq("employee_id", employee.id)
        .maybeSingle(),
      loadPlacements(admin, [employee.id as string]),
    ]);
    // O organograma manda; a equipe escolhida na conclusão vale até a pessoa ser posicionada.
    audienceKey =
      placements.get(employee.id as string) ??
      (completion?.audience_key as string | null) ??
      audienceFromDepartment(employee.department as string | null);
    const completedAt = completion?.completed_at ? Date.parse(completion.completed_at as string) : 0;
    recentWelcome = completedAt > 0 && Date.now() - completedAt < WELCOME_INTRO_DAYS * 86_400_000;
  }

  const links = linksForAudience(await loadLinks(admin, true), audienceKey);
  const name = ((employee?.full_name as string | undefined) ?? (profile.name as string | null) ?? "").trim();
  return { firstName: name.split(/\s+/)[0] || null, recentWelcome, groups: groupLinksByAudience(links) };
}
