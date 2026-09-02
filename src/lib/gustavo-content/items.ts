import { fetchArticleContent } from "@/lib/content-extraction";
import { getContentCutoffDate } from "@/lib/content-utils";
import {
  GUSTAVO_PLANNER_ASSIGNEE_NAME,
  GUSTAVO_PLANNER_REQUESTING_AREA,
  HISTORY_WINDOW_DAYS,
  DEDUPE_WINDOW_DAYS,
  type GustavoContentStatus,
} from "@/lib/gustavo-content/constants";
import { findSameFact } from "@/lib/gustavo-content/dedupe";
import {
  analyzeCompliance,
  analyzeScore,
  generateAngles,
  generateEditorialContent,
} from "@/lib/gustavo-content/ai";
import { assessEditorialHistory, historyAlertText } from "@/lib/gustavo-content/history";
import {
  preserveArticleText,
  sourceTextForGeneration,
} from "@/lib/gustavo-content/editorial-context";
import {
  buildLinkedInPlannerPayload,
  buildReelPlannerPayload,
  plannerChannelAlreadyCreated,
  type PlannerChannel,
} from "@/lib/gustavo-content/planner";
import { SCORE_SUGGESTION_FROM } from "@/lib/gustavo-content/constants";
import { statusFromScore } from "@/lib/gustavo-content/score";
import { resolveGustavoAnswers } from "@/lib/gustavo-content/answers";
import { GustavoContentError, getGustavoContentAdmin, type GustavoContentActor } from "@/lib/gustavo-content/server";
import { listTheses } from "@/lib/gustavo-content/theses-server";
import { thesisSnapshot, type GustavoThesis } from "@/lib/gustavo-content/theses";
import { ITEM_SELECT, type EditorialAngle, type GustavoContentItem } from "@/lib/gustavo-content/types";
import { listActiveVoice } from "@/lib/gustavo-content/voice-server";
import {
  approvalKindForActor,
  canGenerateDraft,
  canRunEditorialAction,
  canTransition,
  nextStatusAfterThesisMatch,
  resolveOutputEdit,
} from "@/lib/gustavo-content/workflow";
import { canSubmitForApproval } from "@/lib/gustavo-content/compliance";
import { POST_REQUEST_TYPE, REEL_REQUEST_TYPE } from "@/lib/planner-posts";
import { getStrategy } from "@/lib/gustavo-content/strategy-server";

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generationFailed(err: unknown, fallback: string): never {
  if (err instanceof GustavoContentError) throw err;
  const message = err instanceof Error ? err.message : "";
  if (/context|token|too large|maximum/i.test(message)) {
    throw new GustavoContentError(
      "O material desta pauta é longo demais para gerar agora. Tente de novo em instantes.",
      502
    );
  }
  throw new GustavoContentError(fallback, 502);
}

export async function listItems(filters?: {
  statuses?: GustavoContentStatus[];
  topicId?: string;
}): Promise<GustavoContentItem[]> {
  const admin = getGustavoContentAdmin();
  let query = admin
    .from("gustavo_content_items")
    .select(ITEM_SELECT)
    .order("editorial_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.statuses?.length) {
    query = query.in("status", filters.statuses);
  }
  if (filters?.topicId) {
    query = query.eq("topic_id", filters.topicId);
  }

  const { data, error } = await query;
  if (error) throw new GustavoContentError(error.message, 500);
  return enrichItems((data ?? []) as GustavoContentItem[]);
}

export async function getItem(id: string): Promise<GustavoContentItem> {
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_items")
    .select(ITEM_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new GustavoContentError(error.message, 500);
  if (!data) throw new GustavoContentError("Pauta não encontrada.", 404);
  const [item] = await enrichItems([data as GustavoContentItem]);
  return item;
}

async function enrichItems(items: GustavoContentItem[]): Promise<GustavoContentItem[]> {
  if (items.length === 0) return items;
  const admin = getGustavoContentAdmin();
  const topicIds = [...new Set(items.map((item) => item.topic_id).filter(Boolean))] as string[];
  const thesisIds = [...new Set(items.map((item) => item.thesis_id).filter(Boolean))] as string[];

  const [topicsRes, thesesRes] = await Promise.all([
    topicIds.length
      ? admin.from("gustavo_content_topics").select("id, name").in("id", topicIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    thesisIds.length
      ? admin.from("gustavo_content_theses").select("id, title").in("id", thesisIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);

  const topics = new Map((topicsRes.data ?? []).map((row) => [row.id, row.name]));
  const theses = new Map((thesesRes.data ?? []).map((row) => [row.id, row.title]));
  return items.map((item) => ({
    ...item,
    topic_name: item.topic_id ? topics.get(item.topic_id) ?? null : null,
    thesis_title: item.thesis_id ? theses.get(item.thesis_id) ?? null : null,
  }));
}

export async function listRecentForDedupe() {
  const admin = getGustavoContentAdmin();
  const since = getContentCutoffDate(DEDUPE_WINDOW_DAYS).toISOString();
  const { data, error } = await admin
    .from("gustavo_content_items")
    .select("id, title, link")
    .gte("created_at", since);
  if (error) throw new GustavoContentError(error.message, 500);
  return data ?? [];
}

async function assertNotDuplicate(title: string, link: string | null) {
  const existing = await listRecentForDedupe();
  const hit = findSameFact(existing, { title, link });
  if (hit) {
    throw new GustavoContentError("Esta pauta já existe no radar (mesmo fato).", 409);
  }
}

export async function createItemFromLink(
  url: string,
  actor: { id: string; name: string }
): Promise<GustavoContentItem> {
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid");
    }
  } catch {
    throw new GustavoContentError("Informe um link http(s) válido.", 400);
  }

  const article = await fetchArticleContent(parsed.toString());
  const link = article.resolvedUrl ?? parsed.toString();
  const title = (article.title ?? "").trim();
  const snippet = article.text.slice(0, 500);

  if (!title && !article.text) {
    throw new GustavoContentError(
      "Esse site não deixa o sistema ler a matéria (bloqueio, login ou paywall). Cole a ideia em texto.",
      422
    );
  }

  const finalTitle = title || "Pauta a partir de link";
  await assertNotDuplicate(finalTitle, link);

  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_items")
    .insert({
      source: "manual_link",
      title: finalTitle,
      link,
      content_snippet: snippet || null,
      image_url: article.imageUrl,
      source_context: {
        facts: [],
        numbers: [],
        companies: [],
        dates: [],
        sourceUrls: [link],
        articleText: preserveArticleText(article.text),
        extractionWarning: article.text ? null : "Matéria incompleta — seguimos com título e resumo.",
      },
      status: "sugestao",
      created_by: actor.id,
      created_by_name: actor.name,
    })
    .select(ITEM_SELECT)
    .single();
  if (error || !data) {
    throw new GustavoContentError(error?.message ?? "Não foi possível criar a pauta.", 500);
  }

  return analyzeItem(data.id as string);
}

export async function createItemFromIdea(
  idea: string,
  actor: { id: string; name: string }
): Promise<GustavoContentItem> {
  const text = idea.trim();
  if (text.length < 20) {
    throw new GustavoContentError("Descreva a ideia com um pouco mais de contexto.", 400);
  }

  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_items")
    .insert({
      source: "manual_idea",
      title: text.slice(0, 140),
      content_snippet: text,
      status: "sugestao",
      created_by: actor.id,
      created_by_name: actor.name,
    })
    .select(ITEM_SELECT)
    .single();
  if (error || !data) {
    throw new GustavoContentError(error?.message ?? "Não foi possível criar a pauta.", 500);
  }
  return analyzeItem(data.id as string);
}

async function loadContext() {
  const [theses, voice, previous, strategy] = await Promise.all([
    listTheses(),
    listActiveVoice(),
    listHistoryItems(),
    getStrategy(),
  ]);
  return {
    theses: theses.filter((thesis) => thesis.status !== "disabled"),
    voice,
    previous,
    strategy,
  };
}

async function listHistoryItems() {
  const admin = getGustavoContentAdmin();
  const since = getContentCutoffDate(HISTORY_WINDOW_DAYS).toISOString();
  const { data } = await admin
    .from("gustavo_content_items")
    .select(
      "title, thesis_id, selected_angle, source_context, linkedin_post, alternative_hooks, created_at, status"
    )
    .in("status", ["rascunho", "aguardando_aprovacao", "aprovado", "enviado_mkt", "publicado"])
    .gte("created_at", since);
  return data ?? [];
}

export async function analyzeItem(id: string): Promise<GustavoContentItem> {
  const item = await getItem(id);
  if (!canRunEditorialAction("analyze", item.status)) {
    throw new GustavoContentError("Esta pauta não pode ser reanalisada nesta etapa.", 409);
  }
  const { theses, strategy } = await loadContext();
  const article = sourceTextForGeneration({
    contentSnippet: item.content_snippet,
    sourceContext: item.source_context,
  });

  const score = await analyzeScore({
    title: item.title ?? "",
    snippet: item.content_snippet ?? "",
    article,
    link: item.link,
    theses,
    strategy,
  });

  const status = statusFromScore(score.total);
  if (!status) {
    if (item.editorial_score != null) {
      return updateItemRow(id, {
        editorial_score: score.total,
        score_breakdown: score.breakdown,
        score_reason: score.reason,
        business_problem: score.businessProblem,
        recommended_channels: score.recommendedChannels,
      });
    }
    const admin = getGustavoContentAdmin();
    await admin.from("gustavo_content_items").delete().eq("id", id);
    throw new GustavoContentError(
      "Score abaixo de 55 — esta pauta foi descartada automaticamente.",
      422
    );
  }

  const patch: Record<string, unknown> = {
    editorial_score: score.total,
    score_breakdown: score.breakdown,
    score_reason: score.reason,
    business_problem: score.businessProblem,
    source_context: {
      ...score.sourceContext,
      articleText: item.source_context?.articleText ?? null,
      extractionWarning: item.source_context?.extractionWarning ?? null,
    },
    recommended_channels: score.recommendedChannels,
    status,
  };

  if (score.total >= SCORE_SUGGESTION_FROM) {
    const angles = await generateAngles({
      title: item.title ?? "",
      snippet: item.content_snippet ?? "",
      article,
      link: item.link,
      theses,
      strategy,
    });
    Object.assign(patch, applyThesisMatch(angles, theses, status));
  }

  return updateItemRow(id, patch);
}

function applyThesisMatch(
  angles: {
    angles: EditorialAngle[];
    thesisMatch: { thesisId: string | null; confidence: string; reason: string };
    questions: string[];
  },
  theses: GustavoThesis[],
  currentStatus: GustavoContentStatus
) {
  const matched = theses.find((thesis) => thesis.id === angles.thesisMatch.thesisId) ?? null;
  const validated = matched?.status === "validated" ? matched : null;
  const opinionStatus = validated ? "validated" : "needs_gustavo";
  const next =
    currentStatus === "radar"
      ? "radar"
      : nextStatusAfterThesisMatch({ opinionStatus });

  return {
    angles: angles.angles,
    selected_angle: angles.angles[0] ?? null,
    thesis_id: validated?.id ?? matched?.id ?? null,
    thesis_snapshot: validated
      ? thesisSnapshot(validated)
      : matched
        ? thesisSnapshot(matched)
        : null,
    opinion_status: opinionStatus,
    gustavo_questions: opinionStatus === "needs_gustavo" ? angles.questions.slice(0, 3) : [],
    status: next,
  };
}

export async function selectAngle(id: string, angleIndex: number): Promise<GustavoContentItem> {
  const item = await getItem(id);
  const angle = item.angles?.[angleIndex];
  if (!angle) throw new GustavoContentError("Ângulo inválido.", 400);
  return updateItemRow(id, { selected_angle: angle });
}

export async function generateItemContent(id: string): Promise<GustavoContentItem> {
  const item = await getItem(id);
  if (!canRunEditorialAction("generate", item.status)) {
    throw new GustavoContentError("O conteúdo não pode ser regenerado nesta etapa.", 409);
  }
  if (!canGenerateDraft({ opinionStatus: item.opinion_status })) {
    throw new GustavoContentError(
      "Ainda precisamos da opinião do Gustavo para gerar o conteúdo em primeira pessoa.",
      409
    );
  }

  const { theses, voice, previous, strategy } = await loadContext();
  const history = assessEditorialHistory(
    {
      title: item.title,
      thesisId: item.thesis_id,
      angleType: item.selected_angle?.type,
      companies: item.source_context?.companies ?? [],
    },
    previous
  );

  let content;
  try {
    content = await generateEditorialContent({
      title: item.title ?? "",
      snippet: item.content_snippet ?? "",
      article: sourceTextForGeneration({
        contentSnippet: item.content_snippet,
        sourceContext: item.source_context,
      }),
      link: item.link,
      businessProblem: item.business_problem,
      selectedAngle: item.selected_angle,
      thesisSnapshot: item.thesis_snapshot,
      answers: item.gustavo_answers,
      questions: item.gustavo_questions,
      theses,
      voice,
      history,
      sourceContext: item.source_context,
      strategy,
    });
  } catch (err) {
    throw generationFailed(
      err,
      "Não foi possível gerar o rascunho agora. Sua visão já está salva — tente gerar de novo."
    );
  }

  const reelScript = JSON.stringify(content.reel);
  let compliance = null;
  try {
    compliance = await analyzeCompliance({
      linkedinPost: content.linkedinPost,
      reelScript,
    });
  } catch {
    compliance = null;
  }

  const updated = await updateItemRow(id, {
    linkedin_post: content.linkedinPost,
    original_linkedin_post: item.original_linkedin_post ?? content.linkedinPost,
    reel_script: reelScript,
    original_reel_script: item.original_reel_script ?? reelScript,
    alternative_hooks: content.alternativeHooks,
    compliance_flags: compliance,
    source_context: {
      facts: item.source_context?.facts ?? [],
      numbers: item.source_context?.numbers ?? [],
      companies: item.source_context?.companies ?? [],
      dates: item.source_context?.dates ?? [],
      sourceUrls: item.source_context?.sourceUrls ?? [],
      articleText: item.source_context?.articleText ?? null,
      extractionWarning: item.source_context?.extractionWarning ?? null,
      historyAlert: historyAlertText(history),
    },
    status: item.status === "aguardando_opiniao" ? "rascunho" : item.status === "sugestao" ? "rascunho" : item.status,
  });

  if (!item.linkedin_post && item.thesis_id) {
    const actorId = item.edited_by ?? item.created_by;
    if (actorId) await incrementThesisUsage(item.thesis_id, actorId);
  }
  return updated;
}

export async function saveItemAnswers(
  id: string,
  answers: string[],
  actor: GustavoContentActor,
  options?: { skip?: boolean }
): Promise<GustavoContentItem> {
  await getItem(id);
  const cleaned = resolveGustavoAnswers(answers, { skip: options?.skip === true });

  return updateItemRow(id, {
    gustavo_answers: cleaned,
    opinion_status: "validated",
    edited_by: actor.id,
    edited_by_name: actor.name,
    edited_at: new Date().toISOString(),
  });
}

export async function saveItemEdits(
  id: string,
  input: { linkedin_post?: string; reel_script?: string },
  actor: GustavoContentActor
): Promise<GustavoContentItem> {
  const item = await getItem(id);
  const linkedin = resolveOutputEdit({
    current: item.linkedin_post,
    incoming: input.linkedin_post ?? item.linkedin_post ?? "",
    original: item.original_linkedin_post,
  });
  const reel = resolveOutputEdit({
    current: item.reel_script,
    incoming: input.reel_script ?? item.reel_script ?? "",
    original: item.original_reel_script,
  });
  const contentChanged =
    linkedin.value !== (item.linkedin_post ?? "") || reel.value !== (item.reel_script ?? "");

  return updateItemRow(id, {
    linkedin_post: linkedin.value || null,
    original_linkedin_post: linkedin.original,
    reel_script: reel.value || null,
    original_reel_script: reel.original,
    has_alterations: linkedin.hasAlterations || reel.hasAlterations,
    compliance_flags: contentChanged ? null : item.compliance_flags,
    edited_by: actor.id,
    edited_by_name: actor.name,
    edited_at: new Date().toISOString(),
  });
}

export async function submitToGustavo(id: string): Promise<GustavoContentItem> {
  const item = await getItem(id);
  if (!item.linkedin_post && !item.reel_script) {
    throw new GustavoContentError("Gere o conteúdo antes de enviar para aprovação.", 400);
  }
  const compliance = await analyzeCompliance({
    linkedinPost: item.linkedin_post ?? "",
    reelScript: item.reel_script ?? "",
  });
  if (!canSubmitForApproval(compliance)) {
    await updateItemRow(id, { compliance_flags: compliance });
    throw new GustavoContentError(
      "Há um alerta grave de compliance. Corrija o texto antes de enviar.",
      409
    );
  }
  if (!canTransition(item.status, "aguardando_aprovacao")) {
    throw new GustavoContentError("Esta pauta não pode ir para aprovação agora.", 409);
  }
  return updateItemRow(id, {
    status: "aguardando_aprovacao",
    compliance_flags: compliance,
    submitted_to_gustavo_at: new Date().toISOString(),
  });
}

export async function approveItem(
  id: string,
  actor: GustavoContentActor
): Promise<GustavoContentItem> {
  const item = await getItem(id);
  if (!canTransition(item.status, "aprovado")) {
    throw new GustavoContentError("Esta pauta não está aguardando aprovação.", 409);
  }
  return updateItemRow(id, {
    status: "aprovado",
    approved_by: actor.id,
    approved_at: new Date().toISOString(),
    approval_kind: approvalKindForActor(actor),
  });
}

export async function rejectItem(
  id: string,
  reason: string | null
): Promise<GustavoContentItem> {
  const item = await getItem(id);
  if (!canTransition(item.status, "rejeitado")) {
    throw new GustavoContentError("Esta pauta não pode ser rejeitada agora.", 409);
  }
  return updateItemRow(id, {
    status: "rejeitado",
    rejection_reason: reason?.trim() || null,
  });
}

export async function markPublished(
  id: string,
  input: {
    linkedin_published_url?: string | null;
    instagram_published_url?: string | null;
    linkedin_published_at?: string | null;
    instagram_published_at?: string | null;
  }
): Promise<GustavoContentItem> {
  const item = await getItem(id);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (input.linkedin_published_url !== undefined) {
    patch.linkedin_published_url = input.linkedin_published_url?.trim() || null;
    patch.linkedin_published_at =
      input.linkedin_published_at || (input.linkedin_published_url ? now : null);
  }
  if (input.instagram_published_url !== undefined) {
    patch.instagram_published_url = input.instagram_published_url?.trim() || null;
    patch.instagram_published_at =
      input.instagram_published_at || (input.instagram_published_url ? now : null);
  }

  const nextLinkedin = (patch.linkedin_published_url as string | null | undefined) ?? item.linkedin_published_url;
  const nextInstagram =
    (patch.instagram_published_url as string | null | undefined) ?? item.instagram_published_url;
  if (nextLinkedin || nextInstagram) {
    if (canTransition(item.status, "publicado") || item.status === "publicado") {
      patch.status = "publicado";
    }
  }
  return updateItemRow(id, patch);
}

export async function sendItemToPlanner(
  id: string,
  channel: PlannerChannel,
  actor: GustavoContentActor
): Promise<GustavoContentItem> {
  const item = await getItem(id);
  if (item.status !== "aprovado" && item.status !== "enviado_mkt" && item.status !== "publicado") {
    throw new GustavoContentError("Aprove o conteúdo antes de criar a tarefa no Planner.", 409);
  }
  if (plannerChannelAlreadyCreated(item, channel)) {
    throw new GustavoContentError("Essa tarefa já foi criada no Planner.", 409);
  }

  const payload =
    channel === "linkedin" ? buildLinkedInPlannerPayload(item) : buildReelPlannerPayload(item);
  if (channel === "linkedin" && !item.linkedin_post) {
    throw new GustavoContentError("Não há post de LinkedIn para enviar.", 400);
  }
  if (channel === "reel" && !item.reel_script) {
    throw new GustavoContentError("Não há roteiro de Reel para enviar.", 400);
  }

  const admin = getGustavoContentAdmin();
  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  if (GUSTAVO_PLANNER_ASSIGNEE_NAME) {
    const { data: designer } = await admin
      .from("users")
      .select("id, name")
      .ilike("name", GUSTAVO_PLANNER_ASSIGNEE_NAME)
      .maybeSingle();
    assigneeId = designer?.id ?? null;
    assigneeName = designer?.name ?? GUSTAVO_PLANNER_ASSIGNEE_NAME;
  }

  const { data: created, error } = await admin
    .from("marketing_requests")
    .insert({
      title: payload.title,
      description: payload.description,
      requesting_area: GUSTAVO_PLANNER_REQUESTING_AREA,
      request_type: channel === "linkedin" ? POST_REQUEST_TYPE : REEL_REQUEST_TYPE,
      status: "pending",
      workflow_stage: "tarefas",
      priority: "normal",
      deadline: formatDateYMD(addBusinessDays(new Date(), 3)),
      deadline_time: "14:00",
      assignee: assigneeName,
      assignee_id: assigneeId,
      solicitante: actor.name,
      solicitante_id: actor.id,
      created_by: actor.name,
      created_by_id: actor.id,
      nome_advogado: "Gustavo Bismarchi Motta",
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new GustavoContentError(error?.message ?? "Não foi possível criar a tarefa.", 500);
  }

  const field =
    channel === "linkedin" ? "marketing_request_linkedin_id" : "marketing_request_reel_id";
  return updateItemRow(id, {
    [field]: created.id,
    status: item.status === "aprovado" ? "enviado_mkt" : item.status,
  });
}

async function incrementThesisUsage(thesisId: string, actorId: string) {
  const admin = getGustavoContentAdmin();
  const { data } = await admin
    .from("gustavo_content_theses")
    .select("usage_count")
    .eq("id", thesisId)
    .maybeSingle();
  if (!data) return;
  await admin
    .from("gustavo_content_theses")
    .update({
      usage_count: (data.usage_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
      updated_by: actorId,
    })
    .eq("id", thesisId);
}

async function updateItemRow(
  id: string,
  patch: Record<string, unknown>
): Promise<GustavoContentItem> {
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_items")
    .update(patch)
    .eq("id", id)
    .select(ITEM_SELECT)
    .maybeSingle();
  if (error) throw new GustavoContentError(error.message, 500);
  if (!data) throw new GustavoContentError("Pauta não encontrada.", 404);
  const [item] = await enrichItems([data as GustavoContentItem]);
  return item;
}
