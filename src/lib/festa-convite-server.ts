import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/access-control";
import { FESTA_10_ANOS_EVENT_ID, firstNameOf, formatRsvpDeadline } from "@/lib/event-rsvp";
import { resolveRsvpViewer, rsvpAdminClient, type RsvpViewer } from "@/lib/event-rsvp-server";
import { loadPeopleDirectory } from "@/lib/rh/people-directory";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import {
  CONVITE_SAMPLE_TOKEN,
  classifyPhone,
  dietarySummary,
  isInviteToken,
  parseDietaryChoice,
  type BoardAction,
  type BoardInvite,
  type BoardPerson,
  type ConvitesBoard,
  type DietaryChoice,
  type GuestAnswer,
  type GuestInviteView,
  type SentChannel,
} from "@/lib/festa-convite";

const LOG = "festa-convite";
const EVENT_ID = FESTA_10_ANOS_EVENT_ID;
const SENT_CHANNELS: SentChannel[] = ["whatsapp", "copia", "manual"];
const INVITE_SELECT =
  "id, name, email, phone, company, notes, invite_token, sender_user_id, sent_at, sent_channel, opened_at, open_count, confirmation_status, plus_one, plus_one_name, dietary_restrictions, dietary_info, show_company_logo, responded_at";

interface InviteRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  invite_token: string | null;
  sender_user_id: string | null;
  sent_at: string | null;
  sent_channel: string | null;
  opened_at: string | null;
  open_count: number | null;
  confirmation_status: string;
  plus_one: boolean | null;
  plus_one_name: string | null;
  dietary_restrictions: string | null;
  dietary_info: unknown;
  show_company_logo: boolean | null;
  responded_at: string | null;
}

function fail(message: string, status: number, code: string): never {
  throw new RhHttpError(message, status, code);
}

async function loadDeadline(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.from("events").select("guest_rsvp_closes_at").eq("id", EVENT_ID).maybeSingle();
  if (error) {
    console.error(`[${LOG}] evento:`, error);
    fail("Não foi possível carregar o evento.", 500, "QUERY_FAILED");
  }
  return (data?.guest_rsvp_closes_at as string | null) ?? null;
}

function isOpen(closesAt: string | null): boolean {
  return !closesAt || Date.now() <= new Date(closesAt).getTime();
}

function attendingOf(status: string): boolean | null {
  if (status === "confirmado") return true;
  if (status === "recusado") return false;
  return null;
}

const LOGO_BUCKET = "MARKETING-SYSTEM-PROJETOS";

/** Logo do grupo do cliente (a mesma do ICP, em icp_group_profiles), pelo nome do grupo gravado no convite. */
async function loadLogos(db: SupabaseClient, companies: (string | null)[]): Promise<Map<string, string>> {
  const names = [...new Set(companies.map((name) => name?.trim()).filter(Boolean))] as string[];
  const logos = new Map<string, string>();
  if (names.length === 0) return logos;
  const { data, error } = await db.from("icp_group_profiles").select("grupo, logo_path, updated_at").in("grupo", names).not("logo_path", "is", null);
  if (error) {
    console.error(`[${LOG}] logos:`, error);
    return logos;
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  for (const row of data ?? []) {
    // O arquivo é regravado no mesmo caminho: a data evita a logo antiga no cache.
    logos.set(row.grupo as string, `${base}/storage/v1/object/public/${LOGO_BUCKET}/${row.logo_path}?v=${Date.parse(row.updated_at as string)}`);
  }
  return logos;
}

/** Restrição gravada pelo convite; resposta antiga (só texto) volta como "Outra". */
function storedDietary(row: InviteRow): { guest: DietaryChoice | null; plusOne: DietaryChoice | null } {
  const info = (row.dietary_info ?? null) as { guest?: unknown; plusOne?: unknown } | null;
  if (info && typeof info === "object") {
    return { guest: info.guest ? (parseDietaryChoice(info.guest) ?? null) : null, plusOne: info.plusOne ? (parseDietaryChoice(info.plusOne) ?? null) : null };
  }
  const legacy = row.dietary_restrictions?.trim();
  return { guest: legacy ? { restrictions: ["outra"], notes: legacy.slice(0, 120) } : null, plusOne: null };
}

/* ───────────────────────── Página do cliente (sem login) ───────────────────────── */

async function findByToken(db: SupabaseClient, token: string): Promise<InviteRow> {
  if (!isInviteToken(token)) fail("Convite não encontrado. Confira o link que você recebeu.", 404, "NOT_FOUND");
  const { data, error } = await db
    .from("event_invites")
    .select(INVITE_SELECT)
    .eq("event_id", EVENT_ID)
    .eq("guest_type", "cliente")
    .eq("invite_token", token)
    .maybeSingle();
  if (error) {
    console.error(`[${LOG}] convite:`, error);
    fail("Não foi possível carregar o convite. Tente de novo.", 500, "QUERY_FAILED");
  }
  if (!data) fail("Convite não encontrado. Confira o link que você recebeu.", 404, "NOT_FOUND");
  return data as InviteRow;
}

function toGuestView(row: InviteRow, closesAt: string | null, sample: boolean, logoUrl: string | null): GuestInviteView {
  const answered = Boolean(row.responded_at);
  const dietary = storedDietary(row);
  return {
    firstName: firstNameOf(row.name),
    name: row.name.trim(),
    logoUrl: row.show_company_logo === false ? null : logoUrl,
    closesAt,
    open: isOpen(closesAt),
    attending: row.responded_at ? attendingOf(row.confirmation_status) : null,
    plusOne: row.responded_at ? row.plus_one : null,
    plusOneName: row.plus_one_name,
    dietary: answered ? dietary.guest : null,
    plusOneDietary: answered ? dietary.plusOne : null,
    respondedAt: row.responded_at,
    sample,
  };
}

/**
 * Convite pelo link pessoal. `track`: conta a abertura (só visita de cliente; quem está
 * logado no ORQESTRAI ou abre a prévia não conta).
 */
export async function getGuestInviteView(token: string, options: { track: boolean; preview: boolean }): Promise<GuestInviteView> {
  const db = rsvpAdminClient();
  const closesAt = await loadDeadline(db);
  if (token === CONVITE_SAMPLE_TOKEN) {
    return { firstName: "", name: "", logoUrl: null, closesAt, open: true, attending: null, plusOne: null, plusOneName: null, dietary: null, plusOneDietary: null, respondedAt: null, sample: true };
  }
  const row = await findByToken(db, token);
  if (options.track && !options.preview) {
    const { error } = await db
      .from("event_invites")
      .update({ opened_at: row.opened_at ?? new Date().toISOString(), open_count: (row.open_count ?? 0) + 1 })
      .eq("id", row.id);
    if (error) console.error(`[${LOG}] abertura:`, error);
  }
  const logos = await loadLogos(db, [row.company]);
  return toGuestView(row, closesAt, options.preview, logos.get(row.company?.trim() ?? "") ?? null);
}

export async function saveGuestAnswer(token: string, answer: GuestAnswer): Promise<GuestInviteView> {
  const db = rsvpAdminClient();
  if (token === CONVITE_SAMPLE_TOKEN) fail("Esta é uma página de demonstração: nada é gravado.", 409, "SAMPLE");
  const closesAt = await loadDeadline(db);
  const row = await findByToken(db, token);
  if (!isOpen(closesAt)) {
    const when = closesAt ? ` em ${formatRsvpDeadline(closesAt)}` : "";
    fail(`O prazo para responder terminou${when}. Fale com o seu contato no escritório.`, 409, "CLOSED");
  }
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("event_invites")
    .update({
      confirmation_status: answer.attending ? "confirmado" : "recusado",
      plus_one: answer.attending ? answer.plusOne : false,
      plus_one_name: answer.attending && answer.plusOne ? answer.plusOneName : null,
      dietary_restrictions: answer.attending ? dietarySummary(answer.dietary, answer.plusOneDietary) : null,
      dietary_info: answer.attending ? { guest: answer.dietary, plusOne: answer.plusOneDietary } : null,
      responded_at: now,
      updated_at: now,
    })
    .eq("id", row.id)
    .select(INVITE_SELECT)
    .single();
  if (error || !data) {
    console.error(`[${LOG}] gravar resposta:`, error);
    fail("Não foi possível registrar a sua resposta. Tente de novo.", 500, "SAVE_FAILED");
  }
  const logos = await loadLogos(db, [row.company]);
  return toGuestView(data as InviteRow, closesAt, false, logos.get(row.company?.trim() ?? "") ?? null);
}

/* ───────────────────────── Tela de envio (com login) ───────────────────────── */

/** Gerencia os convites: admin ou acesso a Eventos liberado em Usuários. */
function isManager(viewer: RsvpViewer): boolean {
  return isAdminRole({ role: viewer.role, permissions: viewer.permissions }) || Boolean(viewer.permissions?.includes("/eventos"));
}

async function loadInvites(db: SupabaseClient): Promise<InviteRow[]> {
  const { data, error } = await db
    .from("event_invites")
    .select(INVITE_SELECT)
    .eq("event_id", EVENT_ID)
    .eq("guest_type", "cliente")
    .order("name");
  if (error) {
    console.error(`[${LOG}] lista:`, error);
    fail("Não foi possível carregar os convites.", 500, "QUERY_FAILED");
  }
  const rows = (data ?? []) as InviteRow[];
  // Cliente adicionado à lista depois: ganha o link pessoal na primeira vez que a tela abre.
  for (const row of rows.filter((item) => !item.invite_token)) {
    const token = randomBytes(12).toString("base64url");
    const { error: tokenError } = await db.from("event_invites").update({ invite_token: token }).eq("id", row.id);
    if (tokenError) console.error(`[${LOG}] link pessoal:`, tokenError);
    else row.invite_token = token;
  }
  return rows.filter((row) => row.invite_token);
}

/** Área responsável pelo grupo do cliente (Cadastro de clientes), pela origem gravada na importação. */
async function loadAreas(db: SupabaseClient, rows: InviteRow[]): Promise<Map<string, string>> {
  const personIds: string[] = [];
  const contactIds: string[] = [];
  const sourceOf = new Map<string, { kind: string; id: string }>();
  for (const row of rows) {
    const match = row.notes?.match(/\[event-guest-source:(person|contact):([0-9a-f-]{36})\]/i);
    if (!match) continue;
    sourceOf.set(row.id, { kind: match[1], id: match[2] });
    (match[1] === "person" ? personIds : contactIds).push(match[2]);
  }
  const [people, contacts] = await Promise.all([
    personIds.length ? db.from("email_people").select("id, client_group_id").in("id", personIds) : null,
    contactIds.length ? db.from("email_contacts").select("id, client_group_id").in("id", contactIds) : null,
  ]);
  if (people?.error) console.error(`[${LOG}] pessoas:`, people.error);
  if (contacts?.error) console.error(`[${LOG}] contatos:`, contacts.error);
  const groupOf = new Map<string, string>();
  for (const item of people?.data ?? []) if (item.client_group_id) groupOf.set(`person:${item.id}`, item.client_group_id as string);
  for (const item of contacts?.data ?? []) if (item.client_group_id) groupOf.set(`contact:${item.id}`, item.client_group_id as string);
  const groupIds = [...new Set(groupOf.values())];
  const areaOfGroup = new Map<string, string>();
  if (groupIds.length) {
    const { data, error } = await db.from("email_client_groups").select("id, responsible_area").in("id", groupIds);
    if (error) console.error(`[${LOG}] grupos:`, error);
    for (const group of data ?? []) if (group.responsible_area) areaOfGroup.set(group.id as string, group.responsible_area as string);
  }
  const areas = new Map<string, string>();
  for (const [inviteId, source] of sourceOf) {
    const group = groupOf.get(`${source.kind}:${source.id}`);
    const area = group ? areaOfGroup.get(group) : undefined;
    if (area) areas.set(inviteId, area);
  }
  return areas;
}

async function buildBoard(db: SupabaseClient, viewer: RsvpViewer): Promise<ConvitesBoard> {
  const manager = isManager(viewer);
  const [rows, closesAt, directory] = await Promise.all([loadInvites(db), loadDeadline(db), loadPeopleDirectory(db, LOG)]);
  const visible = manager ? rows : rows.filter((row) => row.sender_user_id === viewer.profileId);
  const [areas, logos] = await Promise.all([loadAreas(db, visible), loadLogos(db, visible.map((row) => row.company))]);

  const assigned = new Set(visible.map((row) => row.sender_user_id).filter(Boolean) as string[]);
  const people: BoardPerson[] = directory
    .filter((person) => person.user_id && (assigned.has(person.user_id) || (manager && person.is_active)))
    .map((person) => ({
      userId: person.user_id as string,
      name: person.short_name,
      firstName: firstNameOf(person.short_name),
      position: person.position,
      department: person.department,
      avatarUrl: person.avatar_url,
      partner: /s[óo]cio/i.test(person.position ?? ""),
    }));
  const self = directory.find((person) => person.user_id === viewer.profileId);

  const invites: BoardInvite[] = visible.map((row) => ({
    id: row.id,
    name: row.name,
    firstName: firstNameOf(row.name),
    company: row.company,
    area: areas.get(row.id) ?? null,
    email: row.email?.trim() || null,
    phone: classifyPhone(row.phone),
    senderUserId: row.sender_user_id,
    token: row.invite_token as string,
    logoUrl: logos.get(row.company?.trim() ?? "") ?? null,
    showLogo: row.show_company_logo !== false,
    sentAt: row.sent_at,
    sentChannel: SENT_CHANNELS.includes(row.sent_channel as SentChannel) ? (row.sent_channel as SentChannel) : null,
    openedAt: row.opened_at,
    attending: row.responded_at ? attendingOf(row.confirmation_status) : null,
    plusOne: row.plus_one === true,
    plusOneName: row.plus_one_name,
    dietary: row.dietary_restrictions,
    respondedAt: row.responded_at,
  }));

  return {
    manager,
    viewer: { userId: viewer.profileId, firstName: firstNameOf(self?.short_name ?? viewer.name) },
    closesAt,
    invites,
    people,
  };
}

export async function getConvitesBoard(): Promise<ConvitesBoard> {
  const db = rsvpAdminClient();
  return buildBoard(db, await resolveRsvpViewer(db));
}

async function ownInvite(db: SupabaseClient, viewer: RsvpViewer, inviteId: string): Promise<{ id: string; sender_user_id: string | null }> {
  const { data, error } = await db
    .from("event_invites")
    .select("id, sender_user_id")
    .eq("id", inviteId)
    .eq("event_id", EVENT_ID)
    .eq("guest_type", "cliente")
    .maybeSingle();
  if (error || !data) fail("Convite não encontrado.", 404, "NOT_FOUND");
  if (!isManager(viewer) && data.sender_user_id !== viewer.profileId) fail("Este convite não está com você.", 403, "FORBIDDEN");
  return data as { id: string; sender_user_id: string | null };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseBoardAction(body: unknown): BoardAction | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const inviteId = typeof input.inviteId === "string" && UUID.test(input.inviteId) ? input.inviteId : null;
  switch (input.action) {
    case "mark_sent":
      return inviteId && SENT_CHANNELS.includes(input.channel as SentChannel)
        ? { action: "mark_sent", inviteId, channel: input.channel as SentChannel }
        : null;
    case "unmark_sent":
      return inviteId ? { action: "unmark_sent", inviteId } : null;
    case "set_phone":
      return inviteId && typeof input.phone === "string" && input.phone.length <= 30
        ? { action: "set_phone", inviteId, phone: input.phone.trim() }
        : null;
    case "set_logo":
      return inviteId && typeof input.show === "boolean" ? { action: "set_logo", inviteId, show: input.show } : null;
    case "set_sender": {
      const ids = Array.isArray(input.inviteIds) ? input.inviteIds.filter((id): id is string => typeof id === "string" && UUID.test(id)) : [];
      const sender = input.senderUserId === null ? null : typeof input.senderUserId === "string" && UUID.test(input.senderUserId) ? input.senderUserId : undefined;
      return ids.length > 0 && ids.length <= 500 && sender !== undefined ? { action: "set_sender", inviteIds: ids, senderUserId: sender } : null;
    }
    case "set_deadline": {
      if (input.closesAt === null) return { action: "set_deadline", closesAt: null };
      const date = typeof input.closesAt === "string" ? new Date(input.closesAt) : null;
      return date && !Number.isNaN(date.getTime()) ? { action: "set_deadline", closesAt: date.toISOString() } : null;
    }
    default:
      return null;
  }
}

/** Ações da tela de envio; devolve a tela atualizada. */
export async function applyBoardAction(action: BoardAction): Promise<ConvitesBoard> {
  const db = rsvpAdminClient();
  const viewer = await resolveRsvpViewer(db);
  const now = new Date().toISOString();
  let error: { message: string } | null = null;

  if (action.action === "mark_sent") {
    const invite = await ownInvite(db, viewer, action.inviteId);
    ({ error } = await db
      .from("event_invites")
      .update({ invite_status: "enviado", sent_at: now, sent_channel: action.channel, sent_by_user_id: viewer.profileId, updated_at: now })
      .eq("id", invite.id));
  } else if (action.action === "unmark_sent") {
    const invite = await ownInvite(db, viewer, action.inviteId);
    ({ error } = await db
      .from("event_invites")
      .update({ invite_status: "nao_enviado", sent_at: null, sent_channel: null, sent_by_user_id: null, updated_at: now })
      .eq("id", invite.id));
  } else if (action.action === "set_phone") {
    const invite = await ownInvite(db, viewer, action.inviteId);
    if (action.phone && classifyPhone(action.phone).kind !== "celular") {
      fail("Informe um celular com DDD, como (19) 91234-5678.", 400, "INVALID_PHONE");
    }
    ({ error } = await db.from("event_invites").update({ phone: action.phone || null, updated_at: now }).eq("id", invite.id));
  } else if (action.action === "set_logo") {
    const invite = await ownInvite(db, viewer, action.inviteId);
    ({ error } = await db.from("event_invites").update({ show_company_logo: action.show, updated_at: now }).eq("id", invite.id));
  } else if (action.action === "set_sender") {
    if (!isManager(viewer)) fail("Só quem gerencia os convites define o remetente.", 403, "FORBIDDEN");
    if (action.senderUserId) {
      const { data } = await db.from("users").select("id, is_active").eq("id", action.senderUserId).maybeSingle();
      if (!data || data.is_active === false) fail("Remetente não encontrado.", 400, "INVALID_SENDER");
    }
    ({ error } = await db
      .from("event_invites")
      .update({ sender_user_id: action.senderUserId, updated_at: now })
      .eq("event_id", EVENT_ID)
      .eq("guest_type", "cliente")
      .in("id", action.inviteIds));
  } else {
    if (!isManager(viewer)) fail("Só quem gerencia os convites define o prazo.", 403, "FORBIDDEN");
    ({ error } = await db.from("events").update({ guest_rsvp_closes_at: action.closesAt }).eq("id", EVENT_ID));
  }

  if (error) {
    console.error(`[${LOG}] ${action.action}:`, error);
    fail("Não foi possível salvar. Tente de novo.", 500, "SAVE_FAILED");
  }
  return buildBoard(db, viewer);
}
