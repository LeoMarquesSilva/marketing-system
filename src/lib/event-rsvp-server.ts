import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { canAccessPath } from "@/lib/access-control";
import { loadPeopleDirectory, type DirectoryPerson } from "@/lib/rh/people-directory";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { getDietaryByUserIds } from "@/lib/rh/registration/server";
import { formatDietary } from "@/lib/rh/registration/types";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { DIETARY_NO_RESTRICTION, dietarySummary, dietaryText, parseDietaryChoice, type DietaryChoice } from "@/lib/festa-convite";
import {
  RSVP_PAGE_BY_EVENT,
  firstNameOf,
  formatRsvpDeadline,
  isRsvpOpen,
  isRsvpTransport,
  type RsvpAnswer,
  type RsvpPanelData,
  type RsvpPerson,
  type RsvpStatus,
  type RsvpView,
} from "@/lib/event-rsvp";

const LOG = "event-rsvp";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** O e-mail do convite pode estar num domínio e o do login no outro. */
const OFFICE_DOMAINS = new Set(["bpplaw.com.br", "bismarchipires.com.br"]);
const INVITE_SELECT =
  "id, name, email, hr_employee_id, confirmation_status, transport, responded_at, plus_one_allowed, plus_one, plus_one_name, dietary_info, dietary_restrictions";

export function rsvpAdminClient(): SupabaseClient {
  if (!serviceKey) throw new RhHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export interface RsvpViewer {
  profileId: string;
  name: string;
  email: string | null;
  role: string | null;
  permissions: string[] | null;
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
}

interface InviteRow {
  id: string;
  name: string;
  email: string | null;
  hr_employee_id: string | null;
  confirmation_status: string;
  transport: string | null;
  responded_at: string | null;
  plus_one_allowed: boolean | null;
  plus_one: boolean | null;
  plus_one_name: string | null;
  dietary_info: unknown;
  dietary_restrictions: string | null;
}

/** Restrições gravadas no próprio convite: {"guest": ..., "plusOne": ...} (mesmo formato do convite dos clientes). */
function storedDietary(row: InviteRow | null): { guest: DietaryChoice | null; plusOne: DietaryChoice | null } {
  const info = (row?.dietary_info ?? null) as { guest?: unknown; plusOne?: unknown } | null;
  if (!info || typeof info !== "object") return { guest: null, plusOne: null };
  return {
    guest: info.guest ? (parseDietaryChoice(info.guest) ?? null) : null,
    plusOne: info.plusOne ? (parseDietaryChoice(info.plusOne) ?? null) : null,
  };
}

export async function resolveRsvpViewer(db: SupabaseClient): Promise<RsvpViewer> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Faça login para continuar.", 401, "UNAUTHENTICATED");
  const { data, error } = await db
    .from("users")
    .select("id, name, email, role, permissions, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (error || !data) throw new RhHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  if (data.is_active === false) throw new RhHttpError("Usuário inativo.", 403, "FORBIDDEN");
  return {
    profileId: data.id as string,
    name: ((data.name as string | null) ?? "").trim(),
    email: (data.email as string | null) ?? null,
    role: (data.role as string | null) ?? null,
    permissions: (data.permissions as string[] | null) ?? null,
  };
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function officeLocalPart(email: string | null | undefined): string | null {
  const [local, domain] = (email ?? "").trim().toLowerCase().split("@");
  return local && domain && OFFICE_DOMAINS.has(domain) ? local : null;
}

/** Colaborador ativo do RH ligado ao login (ou, para quem tem dois logins, com o mesmo nome). */
async function findEmployee(db: SupabaseClient, viewer: RsvpViewer): Promise<Employee | null> {
  const byUser = await db
    .from("hr_employees")
    .select("id, full_name, user_id")
    .eq("user_id", viewer.profileId)
    .eq("is_active", true)
    .limit(1);
  if (byUser.error) console.error(`[${LOG}] colaborador:`, byUser.error);
  if (byUser.data?.[0]) return byUser.data[0] as Employee;
  if (!viewer.name) return null;
  const byName = await db
    .from("hr_employees")
    .select("id, full_name, user_id")
    .eq("is_active", true)
    .ilike("full_name", viewer.name.replace(/[%_\\]/g, "\\$&"));
  if (byName.error) console.error(`[${LOG}] colaborador por nome:`, byName.error);
  return byName.data?.length === 1 ? (byName.data[0] as Employee) : null;
}

/** Convite de colaborador da pessoa: pelo cadastro do RH, pelo nome ou pelo e-mail do escritório. */
async function findInvite(
  db: SupabaseClient,
  eventId: string,
  viewer: RsvpViewer,
  employee: Employee | null
): Promise<InviteRow | null> {
  const { data, error } = await db
    .from("event_invites")
    .select(INVITE_SELECT)
    .eq("event_id", eventId)
    .eq("guest_type", "colaborador");
  if (error) {
    console.error(`[${LOG}] convites:`, error);
    throw new RhHttpError("Não foi possível carregar o seu convite.", 500, "QUERY_FAILED");
  }
  const rows = (data ?? []) as InviteRow[];
  if (employee) {
    const linked = rows.find((row) => row.hr_employee_id === employee.id);
    if (linked) return linked;
  }
  // Convite ainda sem ligação com o RH (ou ligado a esta mesma pessoa).
  const free = rows.filter((row) => !row.hr_employee_id || row.hr_employee_id === employee?.id);
  const names = new Set([normalizeName(employee?.full_name), normalizeName(viewer.name)].filter(Boolean));
  const byName = free.find((row) => names.has(normalizeName(row.name)));
  if (byName) return byName;
  const local = officeLocalPart(viewer.email);
  return (local && free.find((row) => officeLocalPart(row.email) === local)) || null;
}

async function loadDeadline(db: SupabaseClient, eventId: string): Promise<string | null> {
  const { data, error } = await db.from("events").select("id, rsvp_closes_at").eq("id", eventId).maybeSingle();
  if (error) {
    console.error(`[${LOG}] evento:`, error);
    throw new RhHttpError("Não foi possível carregar o evento.", 500, "QUERY_FAILED");
  }
  if (!data) throw new RhHttpError("Evento não encontrado.", 404, "NOT_FOUND");
  return (data.rsvp_closes_at as string | null) ?? null;
}

/** Primeiro nome como a pessoa é conhecida (organograma), senão o do cadastro. */
async function greetingName(db: SupabaseClient, employee: Employee | null, viewer: RsvpViewer): Promise<string> {
  if (employee) {
    const { data } = await db
      .from("org_chart_members")
      .select("display_name, placement")
      .eq("employee_id", employee.id);
    const shown = (data ?? []).find((row) => row.placement !== "hidden" && row.display_name);
    if (shown) return firstNameOf(shown.display_name as string);
  }
  return firstNameOf(employee?.full_name ?? viewer.name);
}

async function dietaryOf(db: SupabaseClient, employee: Employee | null): Promise<string | null> {
  if (!employee?.user_id) return null;
  try {
    const info = (await getDietaryByUserIds(db, [employee.user_id])).get(employee.user_id);
    return info ? formatDietary(info) || null : null;
  } catch (error) {
    console.error(`[${LOG}] restrição alimentar:`, error);
    return null;
  }
}

function attendingOf(status: string | undefined): boolean | null {
  if (status === "confirmado") return true;
  if (status === "recusado") return false;
  return null;
}

async function buildView(db: SupabaseClient, eventId: string, viewer: RsvpViewer): Promise<RsvpView> {
  const employee = await findEmployee(db, viewer);
  const [invite, closesAt, firstName, dietary] = await Promise.all([
    findInvite(db, eventId, viewer, employee),
    loadDeadline(db, eventId),
    greetingName(db, employee, viewer),
    dietaryOf(db, employee),
  ]);
  const stored = storedDietary(invite);
  const going = invite?.confirmation_status === "confirmado";
  return {
    eligible: Boolean(employee || invite),
    firstName,
    closesAt,
    open: isRsvpOpen(closesAt),
    attending: attendingOf(invite?.confirmation_status),
    transport: isRsvpTransport(invite?.transport) ? invite.transport : null,
    respondedAt: invite?.responded_at ?? null,
    dietary,
    // Sem ficha cadastral (ex.: consultor convidado pela lista): a restrição é perguntada na página.
    askDietary: !employee,
    ownDietary: stored.guest,
    plusOneAllowed: Boolean(invite?.plus_one_allowed),
    plusOne: invite?.responded_at && going ? Boolean(invite.plus_one) : null,
    plusOneName: going && invite?.plus_one ? invite.plus_one_name : null,
    plusOneDietary: going && invite?.plus_one ? stored.plusOne : null,
  };
}

/** O que a página de confirmação mostra para quem está logado. */
export async function getRsvpView(eventId: string): Promise<RsvpView> {
  const db = rsvpAdminClient();
  return buildView(db, eventId, await resolveRsvpViewer(db));
}

/** Aviso ao entrar no sistema: a confirmação está aberta e a pessoa (da equipe) ainda não respondeu. */
export async function getRsvpPending(eventId: string): Promise<{ pending: boolean; closesAt: string | null }> {
  const db = rsvpAdminClient();
  const viewer = await resolveRsvpViewer(db);
  const closesAt = await loadDeadline(db, eventId);
  if (!isRsvpOpen(closesAt)) return { pending: false, closesAt };
  const employee = await findEmployee(db, viewer);
  const invite = await findInvite(db, eventId, viewer, employee);
  return { pending: Boolean(employee || invite) && !invite?.responded_at, closesAt };
}

/** Grava a resposta no convite do colaborador (cria o convite se ele ainda não estava na lista). */
export async function saveRsvp(eventId: string, answer: RsvpAnswer): Promise<RsvpView> {
  const db = rsvpAdminClient();
  const viewer = await resolveRsvpViewer(db);
  const closesAt = await loadDeadline(db, eventId);
  if (!isRsvpOpen(closesAt)) {
    const when = closesAt ? ` em ${formatRsvpDeadline(closesAt)}` : "";
    throw new RhHttpError(`O prazo para responder terminou${when}. Fale com a organização da festa.`, 409, "CLOSED");
  }
  const employee = await findEmployee(db, viewer);
  const invite = await findInvite(db, eventId, viewer, employee);
  if (!employee && !invite) {
    throw new RhHttpError("Esta confirmação é só para a equipe do escritório.", 403, "NOT_INVITED");
  }
  const plusOneAllowed = Boolean(invite?.plus_one_allowed);
  if (answer.plusOne && !plusOneAllowed) {
    throw new RhHttpError("O acompanhante não está previsto no seu convite. Fale com a organização da festa.", 403, "PLUS_ONE_NOT_ALLOWED");
  }

  const now = new Date().toISOString();
  const withCompanion = answer.attending && answer.plusOne;
  // Quem não tem ficha cadastral informa a própria restrição aqui; a do acompanhante vale para todos.
  const own = answer.attending && !employee ? (answer.dietary ?? DIETARY_NO_RESTRICTION) : null;
  const companion = withCompanion ? (answer.plusOneDietary ?? DIETARY_NO_RESTRICTION) : null;
  const companionFields =
    plusOneAllowed || !employee
      ? {
          plus_one: withCompanion,
          plus_one_name: withCompanion ? answer.plusOneName : null,
          dietary_info: own || companion ? { guest: own, plusOne: companion } : null,
          dietary_restrictions: dietarySummary(own, companion),
        }
      : {};
  const payload = {
    confirmation_status: answer.attending ? "confirmado" : "recusado",
    transport: answer.attending ? answer.transport : null,
    responded_at: now,
    hr_employee_id: employee?.id ?? invite?.hr_employee_id ?? null,
    updated_at: now,
    ...companionFields,
  };
  const { error } = invite
    ? await db.from("event_invites").update(payload).eq("id", invite.id)
    : await db.from("event_invites").insert({
        event_id: eventId,
        name: employee?.full_name ?? viewer.name,
        email: viewer.email,
        guest_type: "colaborador",
        invite_status: "nao_enviado",
        ...payload,
      });
  if (error) {
    console.error(`[${LOG}] gravar resposta:`, error);
    throw new RhHttpError("Não foi possível registrar a sua resposta. Tente de novo.", 500, "SAVE_FAILED");
  }
  return buildView(db, eventId, viewer);
}

function statusOf(value: string): RsvpStatus {
  return value === "confirmado" || value === "recusado" ? value : "sem_resposta";
}

/** Painel da organização (aba Convidados do evento): respostas da equipe com foto, área e transporte. */
export async function getRsvpPanel(eventId: string): Promise<RsvpPanelData> {
  const db = rsvpAdminClient();
  const viewer = await resolveRsvpViewer(db);
  if (!canAccessPath({ role: viewer.role, permissions: viewer.permissions }, "/eventos")) {
    throw new RhHttpError("Sem acesso a Eventos.", 403, "FORBIDDEN");
  }
  const closesAt = await loadDeadline(db, eventId);
  const pagePath = RSVP_PAGE_BY_EVENT[eventId] ?? null;
  if (!closesAt) return { enabled: false, closesAt: null, open: false, pagePath, people: [] };

  const [invitesResult, directory] = await Promise.all([
    db.from("event_invites").select(INVITE_SELECT).eq("event_id", eventId).eq("guest_type", "colaborador"),
    loadPeopleDirectory(db, LOG),
  ]);
  if (invitesResult.error) {
    console.error(`[${LOG}] painel:`, invitesResult.error);
    throw new RhHttpError("Não foi possível carregar as respostas.", 500, "QUERY_FAILED");
  }
  const byId = new Map(directory.map((person) => [person.id, person]));
  const byName = new Map(directory.map((person) => [normalizeName(person.full_name), person]));
  const rows = (invitesResult.data ?? []) as InviteRow[];
  const personOf = (row: InviteRow): DirectoryPerson | undefined =>
    (row.hr_employee_id ? byId.get(row.hr_employee_id) : undefined) ?? byName.get(normalizeName(row.name));

  // Convidados sem ficha no RH (ex.: consultores): foto e área vêm do login.
  const outsiders = rows.filter((row) => !personOf(row)).map((row) => row.name);
  const loginByName = new Map<string, { avatar: string | null; department: string | null }>();
  if (outsiders.length) {
    const { data: logins, error: loginsError } = await db
      .from("users")
      .select("name, department, avatar_url, photo_onedrive_url")
      .in("name", outsiders)
      .eq("is_active", true);
    if (loginsError) console.error(`[${LOG}] convidados sem ficha:`, loginsError);
    for (const login of logins ?? []) {
      loginByName.set(normalizeName(login.name as string), {
        avatar: resolveEmployeeAvatarUrl(login.avatar_url as string | null, (login.photo_onedrive_url as string | null) ?? null),
        department: (login.department as string | null) ?? null,
      });
    }
  }

  const attendingUserIds = rows
    .filter((row) => row.confirmation_status === "confirmado")
    .map((row) => personOf(row)?.user_id)
    .filter(Boolean) as string[];
  const dietary = await getDietaryByUserIds(db, attendingUserIds).catch((error) => {
    console.error(`[${LOG}] restrições:`, error);
    return new Map();
  });

  const people: RsvpPerson[] = rows.map((row) => {
    const person = personOf(row);
    const status = statusOf(row.confirmation_status);
    const info = status === "confirmado" && person?.user_id ? dietary.get(person.user_id) : undefined;
    const login = person ? undefined : loginByName.get(normalizeName(row.name));
    const stored = storedDietary(row);
    const going = status === "confirmado";
    const companion = going && row.plus_one && row.plus_one_name ? row.plus_one_name : null;
    const ownStored = going && stored.guest ? dietaryText(stored.guest) || "Nenhuma restrição" : null;
    return {
      inviteId: row.id,
      name: person?.full_name ?? row.name,
      shortName: person?.short_name ?? row.name,
      department: person?.department ?? login?.department ?? null,
      avatarUrl: person?.avatar_url ?? login?.avatar ?? null,
      status,
      transport: isRsvpTransport(row.transport) ? row.transport : null,
      respondedAt: row.responded_at,
      dietary: info ? formatDietary(info) || null : ownStored,
      plusOneName: companion,
      plusOneDietary: companion ? dietaryText(stored.plusOne) || null : null,
    };
  });
  people.sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"));
  return { enabled: true, closesAt, open: isRsvpOpen(closesAt), pagePath, people };
}
