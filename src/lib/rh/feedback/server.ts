import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEEDBACK_HR_ONLY } from "@/lib/access-control";
import { notifyEmployees } from "@/lib/notifications/server";
import { openAIKey } from "@/lib/openai-keys";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { FEEDBACK_PHOTOS_BUCKET, categoryInfo } from "@/lib/rh/boas-praticas/types";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import { todayInBrasilia } from "@/lib/rh/pdi/progress";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { UNKNOWN_PERSON, personOf, resolveTeamContext, type TeamContext } from "@/lib/rh/team-context";
import { canDelete, daysAgo, deleteDeadline, excerpt, goodPracticeSentByFeedz, skipGoodPracticeIntro, normalizeVisibility, sanitizeValues, viewerRole, type ViewerInfo, type ViewerRole } from "./rules";
import {
  FEEDBACK_VALUES,
  type CoverageRow,
  type CreateFeedbackInput,
  type CreateRequestInput,
  type FeedbackDetail,
  type FeedbackHrOverview,
  type FeedbackKind,
  type FeedbackOverview,
  type FeedbackRequest,
  type FeedbackRequestStatus,
  type FeedbackSettings,
  type FeedbackSummary,
  type FeedbackTemplate,
  type FeedbackValue,
  type FeedbackVisibility,
  type ValueCount,
} from "./types";

type Ctx = TeamContext;

function failed(context: string, error: unknown): never {
  console.error(`[feedback] ${context}:`, error);
  throw new RhHttpError("Falha ao consultar o feedback.", 500, "QUERY_FAILED");
}

function resolveCtx(): Promise<Ctx> {
  return resolveTeamContext("feedback", ({ isHr }) => {
    if (FEEDBACK_HR_ONLY && !isHr) {
      throw new RhHttpError("O feedback ainda está em teste e só abre para Pessoas e Cultura e administradores.", 403, "FORBIDDEN");
    }
  });
}

async function requireHr(): Promise<Ctx> {
  const ctx = await resolveCtx();
  if (!ctx.isHr) throw new RhHttpError("Você não tem acesso à gestão do feedback.", 403, "FORBIDDEN");
  return ctx;
}

function requireEmployee(ctx: Ctx): string {
  if (!ctx.employeeId) throw new RhHttpError("Seu usuário ainda não está ligado a um cadastro de colaborador. Fale com Pessoas e Cultura.", 400, "NO_EMPLOYEE");
  return ctx.employeeId;
}

const uuid = z.string().uuid();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  return parsed.data;
}

const firstName = (person: PdiPerson | null) => (person?.name ?? "Alguém").split(" ")[0];

// ---------------------------------------------------------------------------
// Configurações e modelos.
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: FeedbackSettings = {
  coverage_days: 30,
  hr_reads_content: true,
  mural_enabled: true,
  ai_enabled: true,
  email_enabled: false,
};

async function loadSettings(db: SupabaseClient): Promise<FeedbackSettings> {
  const { data, error } = await db
    .from("hr_feedback_settings")
    .select("coverage_days, hr_reads_content, mural_enabled, ai_enabled, email_enabled")
    .eq("id", true)
    .maybeSingle();
  if (error) failed("configurações", error);
  return { ...DEFAULT_SETTINGS, ...((data ?? {}) as Partial<FeedbackSettings>) };
}

async function loadTemplates(db: SupabaseClient, onlyActive: boolean): Promise<FeedbackTemplate[]> {
  let query = db.from("hr_feedback_templates").select("id, name, body, kind, is_active").order("sort_order").order("name");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) failed("modelos", error);
  return (data ?? []) as FeedbackTemplate[];
}

function viewerOf(ctx: Ctx, settings: FeedbackSettings): ViewerInfo {
  return { employeeId: ctx.employeeId, team: ctx.team, isHr: ctx.isHr, hrReadsContent: settings.hr_reads_content };
}

// ---------------------------------------------------------------------------
// Leitura.
// ---------------------------------------------------------------------------

const FEEDBACK_SELECT =
  "id, kind, from_employee_id, to_employee_id, visibility, civil_values, value_ratings, template_name, message, in_person, ai_assisted, read_at, created_at, deleted_at, feedz_id, request_id, good_practice_id";

interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  from_employee_id: string;
  to_employee_id: string;
  visibility: FeedbackVisibility;
  civil_values: string[] | null;
  value_ratings: Record<string, number> | null;
  template_name: string | null;
  message: string;
  in_person: boolean;
  ai_assisted: boolean;
  read_at: string | null;
  created_at: string;
  deleted_at: string | null;
  feedz_id: number | null;
  request_id: string | null;
  good_practice_id: string | null;
}

function toSummary(ctx: Ctx, row: FeedbackRow, viewer: ViewerRole, repliesCount: number, full = false): FeedbackSummary {
  return {
    id: row.id,
    kind: row.kind,
    from: personOf(ctx, row.from_employee_id) ?? UNKNOWN_PERSON,
    to: personOf(ctx, row.to_employee_id) ?? UNKNOWN_PERSON,
    visibility: row.visibility,
    civil_values: (row.civil_values ?? []).filter((value): value is FeedbackValue => (FEEDBACK_VALUES as readonly string[]).includes(value)),
    value_ratings: row.value_ratings,
    template_name: row.template_name,
    message: full ? row.message : excerpt(row.kind === "boa_pratica" ? skipGoodPracticeIntro(row.message) : row.message, 320),
    in_person: row.in_person,
    ai_assisted: row.ai_assisted,
    read_at: row.read_at,
    created_at: row.created_at,
    replies_count: repliesCount,
    from_feedz: row.feedz_id !== null,
    request_id: row.request_id,
    good_practice_id: row.good_practice_id,
    viewer,
    deleted_at: row.deleted_at,
  };
}

async function replyCounts(db: SupabaseClient, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  for (let index = 0; index < ids.length; index += 300) {
    const { data, error } = await db.from("hr_feedback_replies").select("feedback_id").in("feedback_id", ids.slice(index, index + 300));
    if (error) failed("respostas", error);
    for (const row of data ?? []) counts.set(row.feedback_id as string, (counts.get(row.feedback_id as string) ?? 0) + 1);
  }
  return counts;
}

const REQUEST_SELECT = "id, requester_employee_id, giver_employee_id, subject_employee_id, message, due_date, status, created_at, answered_at, decline_reason";

function toRequest(ctx: Ctx, row: Record<string, unknown>, today: string): FeedbackRequest {
  const status = row.status as FeedbackRequestStatus;
  const due = (row.due_date as string | null) ?? null;
  return {
    id: row.id as string,
    requester: personOf(ctx, row.requester_employee_id as string) ?? UNKNOWN_PERSON,
    giver: personOf(ctx, row.giver_employee_id as string) ?? UNKNOWN_PERSON,
    subject: personOf(ctx, row.subject_employee_id as string) ?? UNKNOWN_PERSON,
    message: row.message as string,
    due_date: due,
    status,
    created_at: row.created_at as string,
    answered_at: (row.answered_at as string | null) ?? null,
    decline_reason: (row.decline_reason as string | null) ?? null,
    overdue: status === "aberto" && Boolean(due) && (due as string) < today,
  };
}

interface LightRow {
  from_employee_id: string;
  to_employee_id: string;
  created_at: string;
  kind: FeedbackKind;
  civil_values: string[] | null;
}

/** Últimos eventos por pessoa para o painel de cobertura (sem contar Boas práticas). */
function buildCoverage(ctx: Ctx, personIds: string[], rows: LightRow[], requests: Array<{ requester_employee_id: string; created_at: string }>, me: string | null): CoverageRow[] {
  const lastReceived = new Map<string, string>();
  const lastGiven = new Map<string, string>();
  const lastFromMe = new Map<string, string>();
  const receivedTotal = new Map<string, number>();
  const givenTotal = new Map<string, number>();
  const lastRequested = new Map<string, string>();
  const later = (map: Map<string, string>, key: string, value: string) => {
    if (!map.has(key) || (map.get(key) as string) < value) map.set(key, value);
  };
  for (const row of rows) {
    if (row.kind === "boa_pratica") continue;
    later(lastReceived, row.to_employee_id, row.created_at);
    later(lastGiven, row.from_employee_id, row.created_at);
    receivedTotal.set(row.to_employee_id, (receivedTotal.get(row.to_employee_id) ?? 0) + 1);
    givenTotal.set(row.from_employee_id, (givenTotal.get(row.from_employee_id) ?? 0) + 1);
    if (me && row.from_employee_id === me) later(lastFromMe, row.to_employee_id, row.created_at);
  }
  for (const request of requests) later(lastRequested, request.requester_employee_id, request.created_at);
  return personIds
    .map((id) => ({
      person: personOf(ctx, id) ?? UNKNOWN_PERSON,
      days_received: daysAgo(lastReceived.get(id)),
      days_given: daysAgo(lastGiven.get(id)),
      days_requested: daysAgo(lastRequested.get(id)),
      days_from_me: me ? daysAgo(lastFromMe.get(id)) : null,
      received_total: receivedTotal.get(id) ?? 0,
      given_total: givenTotal.get(id) ?? 0,
    }))
    .sort((a, b) => a.person.name.localeCompare(b.person.name, "pt-BR"));
}

function countValues(rows: Array<{ civil_values: string[] | null; to_employee_id: string; kind: FeedbackKind }>, me: string | null): ValueCount[] {
  const mine = new Map<string, number>();
  const company = new Map<string, number>();
  for (const row of rows) {
    if (row.kind === "boa_pratica") continue;
    for (const value of row.civil_values ?? []) {
      company.set(value, (company.get(value) ?? 0) + 1);
      if (me && row.to_employee_id === me) mine.set(value, (mine.get(value) ?? 0) + 1);
    }
  }
  return FEEDBACK_VALUES.map((value) => ({ value, mine: mine.get(value) ?? 0, company: company.get(value) ?? 0 }));
}

export async function getOverview(): Promise<FeedbackOverview> {
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx.db);
  const me = ctx.employeeId;
  const today = todayInBrasilia();
  const viewer = viewerOf(ctx, settings);
  const team = [...ctx.team];

  const [templates, mineResult, teamResult, muralResult, lightResult, requestsResult, teamRequestsResult] = await Promise.all([
    loadTemplates(ctx.db, true),
    me
      ? ctx.db.from("hr_feedbacks").select(FEEDBACK_SELECT).or(`from_employee_id.eq.${me},to_employee_id.eq.${me}`).is("deleted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    team.length
      ? ctx.db.from("hr_feedbacks").select(FEEDBACK_SELECT).eq("visibility", "gestor").in("to_employee_id", team).is("deleted_at", null).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    settings.mural_enabled
      ? ctx.db.from("hr_feedbacks").select(FEEDBACK_SELECT).eq("visibility", "publico").eq("kind", "reconhecimento").is("deleted_at", null).order("created_at", { ascending: false }).limit(60)
      : Promise.resolve({ data: [], error: null }),
    ctx.db.from("hr_feedbacks").select("from_employee_id, to_employee_id, created_at, kind, civil_values").is("deleted_at", null),
    me
      ? ctx.db.from("hr_feedback_requests").select(REQUEST_SELECT).or(`requester_employee_id.eq.${me},giver_employee_id.eq.${me}`).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    team.length ? ctx.db.from("hr_feedback_requests").select("requester_employee_id, created_at").in("requester_employee_id", team) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [label, result] of [
    ["meus feedbacks", mineResult],
    ["equipe", teamResult],
    ["mural", muralResult],
    ["contagens", lightResult],
    ["pedidos", requestsResult],
    ["pedidos da equipe", teamRequestsResult],
  ] as const) {
    if (result.error) failed(label, result.error);
  }

  const mine = (mineResult.data ?? []) as FeedbackRow[];
  const teamRows = (teamResult.data ?? []) as FeedbackRow[];
  const muralRows = (muralResult.data ?? []) as FeedbackRow[];
  const counts = await replyCounts(ctx.db, [...new Set([...mine, ...teamRows, ...muralRows].map((row) => row.id))]);
  const summary = (row: FeedbackRow) => {
    const role = viewerRole(row, viewer);
    return role ? toSummary(ctx, row, role, counts.get(row.id) ?? 0) : null;
  };
  const received = mine.filter((row) => row.to_employee_id === me).map(summary).filter(Boolean) as FeedbackSummary[];
  const sent = mine.filter((row) => row.from_employee_id === me).map(summary).filter(Boolean) as FeedbackSummary[];
  const requests = ((requestsResult.data ?? []) as Record<string, unknown>[]).map((row) => toRequest(ctx, row, today));
  const light = (lightResult.data ?? []) as LightRow[];

  return {
    me: personOf(ctx, me),
    isHr: ctx.isHr,
    isLeader: team.length > 0,
    settings,
    templates,
    people: [...ctx.people.values()].filter((person) => person.is_active && person.id !== me).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    received,
    sent,
    team_feedbacks: teamRows.filter((row) => row.from_employee_id !== me).map(summary).filter(Boolean) as FeedbackSummary[],
    mural: muralRows.map(summary).filter(Boolean) as FeedbackSummary[],
    requests_received: requests.filter((request) => request.giver.id === me),
    requests_sent: requests.filter((request) => request.requester.id === me),
    team_coverage: team.length
      ? buildCoverage(
          ctx,
          team.filter((id) => ctx.people.get(id)?.is_active),
          light.filter((row) => ctx.team.has(row.to_employee_id) || ctx.team.has(row.from_employee_id)),
          (teamRequestsResult.data ?? []) as Array<{ requester_employee_id: string; created_at: string }>,
          me
        )
      : [],
    values: countValues(light, me),
    unread: received.filter((item) => !item.read_at).length,
  };
}

async function loadRow(ctx: Ctx, id: string): Promise<FeedbackRow> {
  const { data, error } = await ctx.db.from("hr_feedbacks").select(FEEDBACK_SELECT).eq("id", id).maybeSingle();
  if (error) failed("feedback", error);
  if (!data) throw new RhHttpError("Feedback não encontrado.", 404, "NOT_FOUND");
  return data as FeedbackRow;
}

/** Quem recebeu abriu: marca lido e, se for Boa prática, o "visualizado" do painel do RH. */
async function markRead(ctx: Ctx, row: FeedbackRow): Promise<string> {
  const now = new Date().toISOString();
  const { error } = await ctx.db.from("hr_feedbacks").update({ read_at: now }).eq("id", row.id).is("read_at", null);
  if (error) failed("marcar lido", error);
  if (row.good_practice_id) {
    const { error: gpError } = await ctx.db
      .from("hr_good_practice_feedbacks")
      .update({ viewed: true, viewed_on: todayInBrasilia(), updated_at: now })
      .eq("id", row.good_practice_id)
      .or("viewed.is.null,viewed.eq.false");
    if (gpError) console.error("[feedback] boa prática visualizada:", gpError);
  }
  return now;
}

async function goodPracticeDetail(ctx: Ctx, id: string): Promise<FeedbackDetail["good_practice"]> {
  const [recordResult, filesResult] = await Promise.all([
    ctx.db.from("hr_good_practice_feedbacks").select("category, occurred_on, area, employee_name").eq("id", id).maybeSingle(),
    ctx.db.from("hr_good_practice_feedback_photos").select("id, storage_path, file_name, content_type").eq("feedback_id", id).order("created_at"),
  ]);
  if (recordResult.error || !recordResult.data) return null;
  const files = (filesResult.data ?? []) as Array<{ id: string; storage_path: string; file_name: string; content_type: string }>;
  let urls = new Map<string, string>();
  if (files.length) {
    const { data } = await ctx.db.storage.from(FEEDBACK_PHOTOS_BUCKET).createSignedUrls(files.map((file) => file.storage_path), 3600);
    urls = new Map((data ?? []).filter((item) => item.signedUrl && item.path).map((item) => [item.path as string, item.signedUrl as string]));
  }
  const record = recordResult.data as { category: string; occurred_on: string; area: string; employee_name: string };
  return {
    category: record.category,
    occurred_on: record.occurred_on,
    area: record.area,
    employee_name: record.employee_name,
    manual_page: categoryInfo(record.category)?.page ?? null,
    attachments: files
      .filter((file) => urls.has(file.storage_path))
      .map((file) => ({ id: file.id, url: urls.get(file.storage_path) as string, content_type: file.content_type, file_name: file.file_name })),
  };
}

export async function getFeedback(id: string): Promise<FeedbackDetail> {
  parse(uuid, id);
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx.db);
  const viewer = viewerOf(ctx, settings);
  const row = await loadRow(ctx, id);
  const role = viewerRole(row, viewer);
  if (!role) throw new RhHttpError("Você não tem acesso a este feedback.", 403, "FORBIDDEN");
  if (role === "destinatario" && !row.read_at) row.read_at = await markRead(ctx, row);

  const participant = role === "remetente" || role === "destinatario";
  const [repliesResult, noteResult] = await Promise.all([
    ctx.db.from("hr_feedback_replies").select("id, author_employee_id, message, created_at").eq("feedback_id", id).order("created_at"),
    participant && ctx.employeeId
      ? ctx.db.from("hr_feedback_notes").select("body").eq("feedback_id", id).eq("author_employee_id", ctx.employeeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (repliesResult.error) failed("respostas", repliesResult.error);
  const replies = (repliesResult.data ?? []).map((reply) => ({
    id: reply.id as string,
    author: personOf(ctx, reply.author_employee_id as string) ?? UNKNOWN_PERSON,
    message: reply.message as string,
    created_at: reply.created_at as string,
    mine: reply.author_employee_id === ctx.employeeId,
  }));
  const goodPractice = row.good_practice_id && (participant || role === "rh") ? await goodPracticeDetail(ctx, row.good_practice_id) : null;

  return {
    ...toSummary(ctx, row, role, replies.length, true),
    replies,
    my_note: ((noteResult.data as { body?: string } | null)?.body ?? "") as string,
    good_practice: goodPractice,
    permissions: {
      canReply: participant && !row.deleted_at,
      canDelete: canDelete(row, viewer),
      canWriteNote: participant && !row.deleted_at,
      deleteUntil: role === "remetente" ? deleteDeadline(row.created_at) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Escrita.
// ---------------------------------------------------------------------------

const createSchema = z.object({
  to_employee_id: uuid,
  kind: z.enum(["reconhecimento", "desenvolvimento"]),
  visibility: z.enum(["privado", "gestor", "publico"]),
  civil_values: z.array(z.string()).max(5),
  template_id: uuid.nullable().optional(),
  message: z.string().trim().min(10, "Escreva o feedback (pelo menos 10 caracteres).").max(20000),
  in_person: z.boolean(),
  ai_assisted: z.boolean().optional(),
  request_id: uuid.nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
});

export async function createFeedback(input: CreateFeedbackInput): Promise<{ id: string }> {
  const data = parse(createSchema, input);
  const ctx = await resolveCtx();
  const me = requireEmployee(ctx);
  const settings = await loadSettings(ctx.db);
  if (data.to_employee_id === me) throw new RhHttpError("Não dá para enviar feedback para você mesmo.", 400, "INVALID_INPUT");
  const recipient = ctx.people.get(data.to_employee_id);
  if (!recipient || !recipient.is_active) throw new RhHttpError("Pessoa não encontrada no cadastro.", 400, "INVALID_INPUT");

  let visibility = normalizeVisibility(data.kind, data.visibility, settings.mural_enabled);
  let requester: string | null = null;
  if (data.request_id) {
    const { data: request, error } = await ctx.db.from("hr_feedback_requests").select("id, requester_employee_id, giver_employee_id, subject_employee_id, status").eq("id", data.request_id).maybeSingle();
    if (error) failed("pedido", error);
    if (!request || request.giver_employee_id !== me) throw new RhHttpError("Pedido de feedback não encontrado.", 404, "NOT_FOUND");
    if (request.status !== "aberto") throw new RhHttpError("Este pedido já foi respondido.", 400, "INVALID_INPUT");
    if (request.subject_employee_id !== data.to_employee_id) throw new RhHttpError("O feedback do pedido vai para a pessoa do pedido.", 400, "INVALID_INPUT");
    requester = request.requester_employee_id as string;
    // Pedido do gestor sobre um liderado: o gestor precisa ver a resposta.
    if (requester !== request.subject_employee_id && visibility === "privado") visibility = "gestor";
  }

  let templateName: string | null = null;
  if (data.template_id) {
    const { data: template } = await ctx.db.from("hr_feedback_templates").select("name").eq("id", data.template_id).maybeSingle();
    templateName = (template?.name as string | undefined) ?? null;
  }

  const { data: saved, error } = await ctx.db
    .from("hr_feedbacks")
    .insert({
      kind: data.kind,
      from_employee_id: me,
      to_employee_id: data.to_employee_id,
      visibility,
      civil_values: sanitizeValues(data.civil_values),
      template_id: data.template_id ?? null,
      template_name: templateName,
      message: data.message,
      in_person: data.in_person,
      ai_assisted: data.ai_assisted ?? false,
      request_id: data.request_id ?? null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !saved) failed("enviar", error);
  const id = saved.id as string;

  if (data.note?.trim()) {
    await ctx.db.from("hr_feedback_notes").upsert({ feedback_id: id, author_employee_id: me, body: data.note.trim(), updated_at: new Date().toISOString() }, { onConflict: "feedback_id,author_employee_id" });
  }
  if (data.request_id) {
    await ctx.db.from("hr_feedback_requests").update({ status: "respondido", answered_at: new Date().toISOString() }).eq("id", data.request_id);
  }

  const myName = firstName(personOf(ctx, me));
  await notifyEmployees(ctx.db, [data.to_employee_id], {
    kind: "feedback_recebido",
    title: data.kind === "reconhecimento" ? `${myName} te deu um reconhecimento` : `${myName} te deu um feedback`,
    body: excerpt(data.message, 140),
    link: `/feedback?f=${id}`,
    actorEmployeeId: me,
    email: settings.email_enabled
      ? { intro: "Você recebeu um feedback no ORQESTRAI. Abra para ler e, se quiser, responder.", button: "Ler o feedback" }
      : null,
  });
  if (requester && requester !== data.to_employee_id) {
    await notifyEmployees(ctx.db, [requester], {
      kind: "feedback_pedido_respondido",
      title: `${myName} respondeu seu pedido de feedback sobre ${firstName(recipient)}`,
      link: `/feedback?f=${id}`,
      actorEmployeeId: me,
    });
  }
  return { id };
}

export async function replyFeedback(id: string, message: string): Promise<void> {
  parse(uuid, id);
  const text = parse(z.string().trim().min(1, "Escreva a resposta.").max(5000), message);
  const ctx = await resolveCtx();
  const me = requireEmployee(ctx);
  const row = await loadRow(ctx, id);
  if (row.deleted_at) throw new RhHttpError("Este feedback foi apagado.", 400, "INVALID_INPUT");
  if (row.from_employee_id !== me && row.to_employee_id !== me) throw new RhHttpError("Só quem enviou e quem recebeu respondem.", 403, "FORBIDDEN");
  const { error } = await ctx.db.from("hr_feedback_replies").insert({ feedback_id: id, author_employee_id: me, message: text });
  if (error) failed("responder", error);

  // Resposta do gestor a uma Boa prática vira o "retorno" no painel do RH.
  if (row.good_practice_id && row.to_employee_id === me) {
    const { data: record } = await ctx.db.from("hr_good_practice_feedbacks").select("manager_action, responded_on").eq("id", row.good_practice_id).maybeSingle();
    if (record) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (!record.responded_on) patch.responded_on = todayInBrasilia();
      if (!record.manager_action) patch.manager_action = text.slice(0, 2000);
      await ctx.db.from("hr_good_practice_feedbacks").update(patch).eq("id", row.good_practice_id);
    }
  }

  const other = row.from_employee_id === me ? row.to_employee_id : row.from_employee_id;
  await notifyEmployees(ctx.db, [other], {
    kind: "feedback_resposta",
    title: `${firstName(personOf(ctx, me))} respondeu ${row.kind === "boa_pratica" ? "a ocorrência de Boas práticas" : "o feedback"}`,
    body: excerpt(text, 140),
    link: `/feedback?f=${id}`,
    actorEmployeeId: me,
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  parse(uuid, id);
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx.db);
  const row = await loadRow(ctx, id);
  if (!canDelete(row, viewerOf(ctx, settings))) {
    throw new RhHttpError("Passaram as 24 h para apagar. Fale com Pessoas e Cultura.", 403, "FORBIDDEN");
  }
  const { error } = await ctx.db.from("hr_feedbacks").update({ deleted_at: new Date().toISOString(), deleted_by: ctx.userId }).eq("id", id);
  if (error) failed("apagar", error);
}

export async function saveNote(id: string, body: string): Promise<void> {
  parse(uuid, id);
  const text = parse(z.string().max(5000), body ?? "");
  const ctx = await resolveCtx();
  const me = requireEmployee(ctx);
  const row = await loadRow(ctx, id);
  if (row.from_employee_id !== me && row.to_employee_id !== me) throw new RhHttpError("Só quem enviou e quem recebeu anotam.", 403, "FORBIDDEN");
  const { error } = await ctx.db
    .from("hr_feedback_notes")
    .upsert({ feedback_id: id, author_employee_id: me, body: text, updated_at: new Date().toISOString() }, { onConflict: "feedback_id,author_employee_id" });
  if (error) failed("anotação", error);
}

const requestSchema = z.object({
  giver_employee_ids: z.array(uuid).min(1, "Escolha quem vai dar o feedback.").max(10, "No máximo 10 pessoas por pedido."),
  subject_employee_id: uuid.nullable().optional(),
  message: z.string().trim().min(5, "Conte sobre o que você quer feedback.").max(2000),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function createRequest(input: CreateRequestInput): Promise<{ count: number }> {
  const data = parse(requestSchema, input);
  const ctx = await resolveCtx();
  const me = requireEmployee(ctx);
  const settings = await loadSettings(ctx.db);
  const subject = data.subject_employee_id ?? me;
  if (subject !== me && !ctx.team.has(subject)) throw new RhHttpError("Você só pede feedback sobre quem lidera.", 403, "FORBIDDEN");
  const givers = [...new Set(data.giver_employee_ids)].filter((id) => id !== subject && id !== me);
  if (!givers.length) throw new RhHttpError("Escolha quem vai dar o feedback.", 400, "INVALID_INPUT");
  const { error } = await ctx.db.from("hr_feedback_requests").insert(
    givers.map((giver) => ({
      requester_employee_id: me,
      giver_employee_id: giver,
      subject_employee_id: subject,
      message: data.message,
      due_date: data.due_date ?? null,
      created_by: ctx.userId,
    }))
  );
  if (error) failed("pedir", error);
  const myName = firstName(personOf(ctx, me));
  await notifyEmployees(ctx.db, givers, {
    kind: "feedback_pedido",
    title: subject === me ? `${myName} pediu seu feedback` : `${myName} pediu seu feedback sobre ${firstName(personOf(ctx, subject))}`,
    body: excerpt(data.message, 140),
    link: "/feedback?aba=pedidos",
    actorEmployeeId: me,
    email: settings.email_enabled
      ? { intro: "Pediram o seu feedback no ORQESTRAI. Abra para ver o pedido e responder.", button: "Ver o pedido" }
      : null,
  });
  return { count: givers.length };
}

export async function declineRequest(id: string, reason: string | null): Promise<void> {
  parse(uuid, id);
  const ctx = await resolveCtx();
  const me = requireEmployee(ctx);
  const { data: request, error } = await ctx.db.from("hr_feedback_requests").select("id, requester_employee_id, giver_employee_id, status").eq("id", id).maybeSingle();
  if (error) failed("pedido", error);
  if (!request || request.giver_employee_id !== me) throw new RhHttpError("Pedido não encontrado.", 404, "NOT_FOUND");
  if (request.status !== "aberto") throw new RhHttpError("Este pedido já foi respondido.", 400, "INVALID_INPUT");
  const { error: updateError } = await ctx.db
    .from("hr_feedback_requests")
    .update({ status: "recusado", answered_at: new Date().toISOString(), decline_reason: reason?.trim().slice(0, 500) || null })
    .eq("id", id);
  if (updateError) failed("recusar", updateError);
  await notifyEmployees(ctx.db, [request.requester_employee_id as string], {
    kind: "feedback_pedido_recusado",
    title: `${firstName(personOf(ctx, me))} não vai conseguir responder seu pedido de feedback`,
    body: reason?.trim() ? excerpt(reason, 140) : null,
    link: "/feedback?aba=pedidos",
    actorEmployeeId: me,
  });
}

// ---------------------------------------------------------------------------
// IA para ajudar a escrever (decisão 10).
// ---------------------------------------------------------------------------

const improveSchema = z.object({
  message: z.string().trim().min(40, "Escreva um pouco mais antes de pedir ajuda à IA.").max(6000),
  kind: z.enum(["reconhecimento", "desenvolvimento"]),
  recipient_name: z.string().max(120).optional(),
});

export async function improveText(input: { message: string; kind: "reconhecimento" | "desenvolvimento"; recipient_name?: string }) {
  const data = parse(improveSchema, input);
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx.db);
  if (!settings.ai_enabled) throw new RhHttpError("A ajuda da IA está desligada nas configurações.", 400, "AI_DISABLED");
  const apiKey = openAIKey("pessoas");
  if (!apiKey) throw new RhHttpError("A IA não está configurada.", 503, "SERVICE_UNAVAILABLE");
  const openai = createOpenAI({ apiKey });
  try {
    const result = await generateObject({
      model: openai(OPENAI_DEFAULT_MODEL),
      schema: z.object({
        texto: z.string().describe("O feedback reescrito, em português do Brasil, em primeira pessoa, pronto para enviar."),
        dica: z.string().describe("Uma frase curta dizendo o que mudou ou o que ainda falta (ex.: faltou dizer o impacto)."),
      }),
      system: [
        "Você ajuda colaboradores de um escritório de advocacia (Bismarchi | Pires) a escrever feedback para colegas.",
        "Reescreva o texto mantendo TODOS os fatos e o sentido; não invente situações, números, datas nem elogios que não estão no original.",
        "Use o formato SCI quando couber: a situação concreta, o comportamento observado e o impacto. Se faltar um desses no original, não invente: aponte na dica.",
        data.kind === "reconhecimento"
          ? "É um reconhecimento: seja específico sobre o que a pessoa fez e por que importou, sem exagero nem clichê."
          : "É um feedback de desenvolvimento: seja respeitoso e direto, foque no comportamento (não na pessoa) e termine com o que se espera dali em diante.",
        "Tom profissional e próximo, frases curtas, sem jargão corporativo, sem emojis, sem saudação nem assinatura. Mantenha o tamanho parecido com o original.",
      ].join("\n"),
      prompt: `Destinatário: ${data.recipient_name ?? "colega"}\n\nTexto original:\n${data.message}`,
      ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "low", temperature: 0.4 }),
    });
    return { text: result.object.texto.trim(), tip: result.object.dica.trim() };
  } catch (error) {
    console.error("[feedback] ia:", error);
    throw new RhHttpError("A IA não respondeu agora. Tente de novo em instantes.", 502, "AI_FAILED");
  }
}

// ---------------------------------------------------------------------------
// Boas práticas enviadas ao gestor (decisão 2).
// ---------------------------------------------------------------------------

export async function sendGoodPractice(goodPracticeId: string): Promise<{ id: string }> {
  parse(uuid, goodPracticeId);
  const ctx = await requireHr();
  const me = requireEmployee(ctx);
  const settings = await loadSettings(ctx.db);
  const { data: record, error } = await ctx.db
    .from("hr_good_practice_feedbacks")
    .select("id, occurred_on, sent_on, employee_name, is_team, manager_employee_id, area, category, description")
    .eq("id", goodPracticeId)
    .maybeSingle();
  if (error) failed("boa prática", error);
  if (!record) throw new RhHttpError("Registro não encontrado.", 404, "NOT_FOUND");
  if (goodPracticeSentByFeedz(record.sent_on as string | null)) {
    throw new RhHttpError("Esta ocorrência já foi enviada ao gestor pelo Feedz.", 409, "ALREADY_SENT");
  }
  const manager = record.manager_employee_id as string | null;
  if (!manager) throw new RhHttpError("O registro não tem gestor. Edite e escolha o gestor antes de enviar.", 400, "INVALID_INPUT");
  if (manager === me) throw new RhHttpError("O gestor do registro é você mesmo.", 400, "INVALID_INPUT");

  const { data: existing } = await ctx.db.from("hr_feedbacks").select("id").eq("good_practice_id", goodPracticeId).is("deleted_at", null).maybeSingle();
  if (existing) throw new RhHttpError("Esta ocorrência já foi enviada ao gestor.", 400, "ALREADY_SENT");

  const info = categoryInfo(record.category as string);
  const [year, month, day] = String(record.occurred_on).split("-");
  const message = [
    `Ocorrência do Manual de Boas Práticas: ${record.category}`,
    `Data: ${day}/${month}/${year} · ${record.is_team ? record.employee_name : `Colaborador: ${record.employee_name}`} · Área: ${record.area}`,
    "",
    String(record.description).trim(),
    "",
    info?.page ? `Manual de Boas Práticas, página ${info.page}.` : "",
    "Conte nas respostas o que foi conversado com a pessoa.",
  ]
    .filter((line, index, lines) => line !== "" || (index > 0 && lines[index - 1] !== ""))
    .join("\n")
    .trim();

  const { data: saved, error: insertError } = await ctx.db
    .from("hr_feedbacks")
    .insert({
      kind: "boa_pratica",
      from_employee_id: me,
      to_employee_id: manager,
      visibility: "privado",
      message,
      good_practice_id: goodPracticeId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (insertError || !saved) failed("enviar boa prática", insertError);
  // O painel das Boas práticas passa a contar o envio daqui: data de envio = hoje e "ainda não visualizado".
  const { error: gpError } = await ctx.db
    .from("hr_good_practice_feedbacks")
    .update({ sent_on: todayInBrasilia(), viewed: false, viewed_on: null, updated_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", goodPracticeId)
    .or("viewed.is.null,viewed.eq.false");
  if (gpError) console.error("[feedback] boa prática enviada:", gpError);
  await notifyEmployees(ctx.db, [manager], {
    kind: "boa_pratica",
    title: `Pessoas e Cultura registrou uma ocorrência de Boas práticas na sua equipe`,
    body: `${record.category} · ${record.employee_name}`,
    link: `/feedback?f=${saved.id}`,
    actorEmployeeId: me,
    email: settings.email_enabled
      ? { intro: "Pessoas e Cultura enviou uma ocorrência de Boas práticas de alguém da sua equipe. Abra para ler e registrar o retorno.", button: "Abrir a ocorrência" }
      : null,
  });
  return { id: saved.id as string };
}

/** Situação do envio de cada registro de Boas práticas (para a tela do RH). */
export async function goodPracticeSendStatus(ids: string[]): Promise<Record<string, { feedback_id: string; sent_at: string; read_at: string | null; replies: number }>> {
  const list = parse(z.array(uuid).max(500), ids);
  const ctx = await requireHr();
  if (!list.length) return {};
  const { data, error } = await ctx.db.from("hr_feedbacks").select("id, good_practice_id, created_at, read_at").in("good_practice_id", list).is("deleted_at", null);
  if (error) failed("envios de boas práticas", error);
  const counts = await replyCounts(ctx.db, (data ?? []).map((row) => row.id as string));
  return Object.fromEntries(
    (data ?? []).map((row) => [
      row.good_practice_id as string,
      { feedback_id: row.id as string, sent_at: row.created_at as string, read_at: (row.read_at as string | null) ?? null, replies: counts.get(row.id as string) ?? 0 },
    ])
  );
}

// ---------------------------------------------------------------------------
// Gestão (RH).
// ---------------------------------------------------------------------------

export async function getHrOverview(): Promise<FeedbackHrOverview> {
  const ctx = await requireHr();
  const settings = await loadSettings(ctx.db);
  const today = todayInBrasilia();
  const [templates, feedbacksResult, requestsResult] = await Promise.all([
    loadTemplates(ctx.db, false),
    ctx.db.from("hr_feedbacks").select(FEEDBACK_SELECT).order("created_at", { ascending: false }),
    ctx.db.from("hr_feedback_requests").select(REQUEST_SELECT).order("created_at", { ascending: false }).limit(500),
  ]);
  if (feedbacksResult.error) failed("histórico", feedbacksResult.error);
  if (requestsResult.error) failed("pedidos", requestsResult.error);
  const rows = (feedbacksResult.data ?? []) as FeedbackRow[];
  const counts = await replyCounts(ctx.db, rows.map((row) => row.id));
  const visible = (row: FeedbackRow) => {
    const summary = toSummary(ctx, row, "rh", counts.get(row.id) ?? 0);
    // Sem a leitura liberada, o RH vê só quem, quando e os valores do que é privado.
    if (!settings.hr_reads_content && row.visibility !== "publico" && row.kind !== "boa_pratica") summary.message = "";
    return summary;
  };
  const requests = ((requestsResult.data ?? []) as Record<string, unknown>[]).map((row) => toRequest(ctx, row, today));
  const active = [...ctx.people.values()].filter((person) => person.is_active).map((person) => person.id);
  return {
    settings,
    templates,
    feedbacks: rows.filter((row) => !row.deleted_at).map(visible),
    deleted: rows.filter((row) => row.deleted_at).map(visible),
    coverage: buildCoverage(
      ctx,
      active,
      rows.filter((row) => !row.deleted_at),
      requests.map((request) => ({ requester_employee_id: request.requester.id, created_at: request.created_at })),
      null
    ),
    requests,
  };
}

const settingsSchema = z
  .object({
    coverage_days: z.number().int().min(7).max(180),
    hr_reads_content: z.boolean(),
    mural_enabled: z.boolean(),
    ai_enabled: z.boolean(),
    email_enabled: z.boolean(),
  })
  .partial();

export async function saveSettings(input: Partial<FeedbackSettings>): Promise<void> {
  const data = parse(settingsSchema, input);
  const ctx = await requireHr();
  const { error } = await ctx.db.from("hr_feedback_settings").update({ ...data, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq("id", true);
  if (error) failed("salvar configurações", error);
}

const templateSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Dê um nome ao modelo.").max(80),
  body: z.string().max(4000),
  kind: z.enum(["reconhecimento", "desenvolvimento"]).nullable(),
  is_active: z.boolean(),
});

export async function saveTemplate(input: z.infer<typeof templateSchema>): Promise<{ id: string }> {
  const data = parse(templateSchema, input);
  const ctx = await requireHr();
  const row = { name: data.name, body: data.body, kind: data.kind, is_active: data.is_active };
  const { data: saved, error } = data.id
    ? await ctx.db.from("hr_feedback_templates").update(row).eq("id", data.id).select("id").single()
    : await ctx.db.from("hr_feedback_templates").insert({ ...row, sort_order: 50 }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new RhHttpError("Já existe um modelo com esse nome.", 409, "DUPLICATE");
    failed("modelo", error);
  }
  return { id: saved?.id as string };
}

// ---------------------------------------------------------------------------
// Lembrete do gestor parado (aparece no sino no máximo uma vez por semana).
// ---------------------------------------------------------------------------

export async function ensureCoverageReminder(db: SupabaseClient, userId: string): Promise<void> {
  const settings = await loadSettings(db);
  const { data: self } = await db.from("hr_employees").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (!self) return;
  const { data: reports } = await db.from("hr_employees").select("id, full_name").eq("manager_employee_id", self.id).eq("is_active", true).eq("is_automation", false);
  if (!reports?.length) return;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "feedback_lembrete").gte("created_at", weekAgo);
  if (count) return;
  const { data: given } = await db
    .from("hr_feedbacks")
    .select("to_employee_id, created_at")
    .eq("from_employee_id", self.id)
    .in("to_employee_id", reports.map((row) => row.id as string))
    .neq("kind", "boa_pratica")
    .is("deleted_at", null);
  const last = new Map<string, string>();
  for (const row of given ?? []) {
    const key = row.to_employee_id as string;
    if (!last.has(key) || (last.get(key) as string) < (row.created_at as string)) last.set(key, row.created_at as string);
  }
  const stale = reports.filter((row) => {
    const days = daysAgo(last.get(row.id as string));
    return days === null || days > settings.coverage_days;
  });
  if (!stale.length) return;
  const first = String(stale[0].full_name).split(" ")[0];
  await db.from("notifications").insert({
    user_id: userId,
    kind: "feedback_lembrete",
    title:
      stale.length === 1
        ? `Faz mais de ${settings.coverage_days} dias que você não dá feedback para ${first}`
        : `Faz mais de ${settings.coverage_days} dias que você não dá feedback para ${first} e mais ${stale.length - 1} ${stale.length - 1 === 1 ? "pessoa" : "pessoas"} da equipe`,
    link: "/feedback?aba=equipe",
  });
}
