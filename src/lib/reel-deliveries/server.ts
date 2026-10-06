import "server-only";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { currentSaoPauloDate, requireContentScheduleActor, type ScheduleActor } from "@/lib/content-schedule/server";
import { resolveContentScheduleAreaLabel } from "@/lib/content-schedule/domain";
import { WORKFLOW_STAGES } from "@/lib/constants";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  REEL_AUDIO_MAX_BYTES,
  REEL_COPY_PROMPT,
  REEL_COVER_REQUEST_TYPE,
  REEL_COVER_SLA_BUSINESS_DAYS,
  REEL_DELIVERIES_BUCKET,
  addBusinessDaysYmd,
  buildCoverRequestDescription,
  canParticipantDecide,
  type ReelCoverPerson,
  reelCopyRequestSchema,
  reelCopySchema,
  reelCreditLine,
  stripDashes,
  isDeliveryStoragePath,
  missingForReady,
  type ReelDecisionValue,
  type ReelDeliveryStatus,
  addReelVersionSchema,
  createReelDeliverySchema,
  reelDecisionSchema,
  updateReelDeliverySchema,
} from "./domain";
import type {
  ReelCoverRequest,
  ReelDecision,
  ReelDeliveriesResponse,
  ReelDeliveryDetail,
  ReelDeliverySummary,
  ReelPerson,
  ReelSlotOption,
  ReelVersion,
} from "./types";
import type { z } from "zod";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SIGNED_URL_SECONDS = 2 * 60 * 60;

export class ReelDeliveryHttpError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

function adminDb(): SupabaseClient {
  if (!serviceKey) throw new ReelDeliveryHttpError("Serviço de reels indisponível.", 503);
  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type DeliveryRow = {
  id: string; slot_id: string | null; area: string; due_date: string | null; title: string | null;
  cover_title: string | null; cover_subtitle: string | null;
  ai_status: "processing" | "done" | "failed" | null; ai_error: string | null;
  status: ReelDeliveryStatus; caption: string | null; cover_path: string | null;
  approved_at: string | null; ready_at: string | null; published_at: string | null; updated_at: string;
};
type ParticipantRow = { delivery_id: string; user_id: string; user_name: string };
type VersionRow = {
  id: string; delivery_id: string; version_number: number; video_path: string; file_name: string;
  size_bytes: number | string; notes: string | null; uploaded_by_name: string | null; created_at: string;
};
type DecisionRow = {
  id: string; delivery_id: string; version_id: string; user_id: string; user_name: string;
  decision: ReelDecisionValue; comment: string | null; recorded_by_id: string | null;
  recorded_by_name: string | null; created_at: string;
};
type UserRow = { id: string; name: string; avatar_url: string | null; department: string | null };

const DELIVERY_COLUMNS =
  "id,slot_id,area,due_date,title,cover_title,cover_subtitle,ai_status,ai_error,status,caption,cover_path,approved_at,ready_at,published_at,updated_at";

function isManager(actor: ScheduleActor): boolean {
  return actor.access.manageAll;
}

function requireManager(actor: ScheduleActor): void {
  if (!isManager(actor)) throw new ReelDeliveryHttpError("Ação exclusiva do Marketing.", 403);
}

async function actorName(db: SupabaseClient, actor: ScheduleActor): Promise<string> {
  const { data } = await db.from("users").select("name").eq("id", actor.profileId).maybeSingle();
  return data?.name?.trim() || "Marketing";
}

function toVersion(row: VersionRow): ReelVersion {
  return {
    id: row.id,
    number: row.version_number,
    fileName: row.file_name,
    sizeBytes: Number(row.size_bytes) || 0,
    notes: row.notes,
    uploadedByName: row.uploaded_by_name,
    createdAt: row.created_at,
  };
}

function toDecision(row: DecisionRow): ReelDecision {
  return {
    id: row.id,
    versionId: row.version_id,
    userId: row.user_id,
    userName: row.user_name,
    decision: row.decision,
    comment: row.comment,
    recordedByName: row.recorded_by_name,
    onBehalf: Boolean(row.recorded_by_id && row.recorded_by_id !== row.user_id),
    createdAt: row.created_at,
  };
}

async function loadPeople(db: SupabaseClient): Promise<Map<string, ReelPerson>> {
  const { data, error } = await db
    .from("users")
    .select("id,name,avatar_url,department")
    .or("is_active.eq.true,is_active.is.null")
    .order("name");
  if (error) throw new ReelDeliveryHttpError("Não foi possível carregar os colaboradores.");
  return new Map(
    ((data ?? []) as UserRow[]).map((u) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatar_url, area: u.department }])
  );
}

async function loadSummaries(
  db: SupabaseClient,
  rows: DeliveryRow[],
  viewerId: string,
  people: Map<string, ReelPerson>
): Promise<{ summaries: ReelDeliverySummary[]; versions: VersionRow[]; decisions: DecisionRow[] }> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return { summaries: [], versions: [], decisions: [] };

  const [participantsRes, versionsRes, decisionsRes] = await Promise.all([
    db.from("reel_delivery_participants").select("delivery_id,user_id,user_name").in("delivery_id", ids),
    db.from("reel_delivery_versions")
      .select("id,delivery_id,version_number,video_path,file_name,size_bytes,notes,uploaded_by_name,created_at")
      .in("delivery_id", ids)
      .order("version_number", { ascending: false }),
    db.from("reel_delivery_decisions")
      .select("id,delivery_id,version_id,user_id,user_name,decision,comment,recorded_by_id,recorded_by_name,created_at")
      .in("delivery_id", ids)
      .order("created_at", { ascending: true }),
  ]);
  if (participantsRes.error || versionsRes.error || decisionsRes.error) {
    throw new ReelDeliveryHttpError("Não foi possível carregar os reels.");
  }
  const participants = (participantsRes.data ?? []) as ParticipantRow[];
  const versions = (versionsRes.data ?? []) as VersionRow[];
  const decisions = (decisionsRes.data ?? []) as DecisionRow[];

  const summaries = rows.map((row) => {
    const rowParticipants = participants
      .filter((p) => p.delivery_id === row.id)
      .map((p) => people.get(p.user_id) ?? { id: p.user_id, name: p.user_name, avatarUrl: null });
    const current = versions.find((v) => v.delivery_id === row.id) ?? null;
    const currentDecisions = current
      ? decisions.filter((d) => d.version_id === current.id).map(toDecision)
      : [];
    const isParticipant = rowParticipants.some((p) => p.id === viewerId);
    return {
      id: row.id,
      slotId: row.slot_id,
      area: row.area,
      dueDate: row.due_date,
      coverTitle: row.cover_title ?? row.title,
      coverSubtitle: row.cover_subtitle,
      status: row.status,
      caption: row.caption,
      aiStatus: row.ai_status,
      aiError: row.ai_error,
      hasCover: Boolean(row.cover_path),
      approvedAt: row.approved_at,
      readyAt: row.ready_at,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      participants: rowParticipants,
      currentVersion: current ? toVersion(current) : null,
      currentDecisions,
      awaitingMe:
        isParticipant &&
        Boolean(current) &&
        canParticipantDecide(row.status) &&
        !currentDecisions.some((d) => d.userId === viewerId),
    } satisfies ReelDeliverySummary;
  });
  return { summaries, versions, decisions };
}

async function visibleDeliveryIds(db: SupabaseClient, actor: ScheduleActor): Promise<string[] | null> {
  if (isManager(actor)) return null;
  const { data, error } = await db
    .from("reel_delivery_participants")
    .select("delivery_id")
    .eq("user_id", actor.profileId);
  if (error) throw new ReelDeliveryHttpError("Não foi possível carregar seus reels.");
  return (data ?? []).map((row) => row.delivery_id as string);
}

export async function listReelDeliveries(): Promise<ReelDeliveriesResponse> {
  const actor = await requireContentScheduleActor();
  const db = adminDb();
  const manager = isManager(actor);
  const visible = await visibleDeliveryIds(db, actor);

  let query = db.from("reel_deliveries").select(DELIVERY_COLUMNS).order("due_date", { ascending: false, nullsFirst: false });
  if (visible) {
    if (visible.length === 0) {
      return { viewer: { id: actor.profileId, isManager: manager }, deliveries: [], slots: [], people: [] };
    }
    query = query.in("id", visible);
  }
  const [{ data: rows, error }, people] = await Promise.all([query, loadPeople(db)]);
  if (error) throw new ReelDeliveryHttpError("Não foi possível carregar os reels.");
  const deliveryRows = (rows ?? []) as DeliveryRow[];
  const { summaries } = await loadSummaries(db, deliveryRows, actor.profileId, people);

  let slots: ReelSlotOption[] = [];
  if (manager) {
    const used = new Set(deliveryRows.map((r) => r.slot_id).filter(Boolean));
    const { data: slotRows, error: slotError } = await db
      .from("content_schedule_slots")
      .select("id,area,due_date,collaborator_id,co_collaborator_id,source_name")
      .eq("format", "reel")
      .eq("cancelled", false)
      .order("due_date", { ascending: true });
    if (slotError) throw new ReelDeliveryHttpError("Não foi possível carregar o cronograma de reels.");
    slots = (slotRows ?? [])
      .filter((slot) => !used.has(slot.id))
      .map((slot) => ({
        id: slot.id,
        area: slot.area,
        dueDate: slot.due_date,
        collaborator: slot.collaborator_id ? people.get(slot.collaborator_id) ?? null : null,
        coCollaborator: slot.co_collaborator_id ? people.get(slot.co_collaborator_id) ?? null : null,
        sourceName: slot.source_name,
      }));
  }

  return {
    viewer: { id: actor.profileId, isManager: manager },
    deliveries: summaries,
    slots,
    people: manager ? [...people.values()] : [],
  };
}

/** Contador do menu: o que espera o usuário (aprovar) ou o Marketing (capa e legenda). */
export async function countPendingReelDeliveries(): Promise<number> {
  const actor = await requireContentScheduleActor();
  const db = adminDb();
  if (isManager(actor)) {
    const { count, error } = await db
      .from("reel_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");
    if (error) throw new ReelDeliveryHttpError("Não foi possível contar os reels.");
    return count ?? 0;
  }
  const visible = await visibleDeliveryIds(db, actor);
  if (!visible?.length) return 0;
  const { data, error } = await db
    .from("reel_deliveries")
    .select(DELIVERY_COLUMNS)
    .in("id", visible)
    .in("status", ["awaiting_approval", "changes_requested", "approved"]);
  if (error) throw new ReelDeliveryHttpError("Não foi possível contar os reels.");
  const { summaries } = await loadSummaries(db, (data ?? []) as DeliveryRow[], actor.profileId, new Map());
  return summaries.filter((s) => s.awaitingMe).length;
}

async function loadDeliveryRow(db: SupabaseClient, id: string): Promise<DeliveryRow> {
  const { data, error } = await db.from("reel_deliveries").select(DELIVERY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new ReelDeliveryHttpError("Não foi possível carregar o reel.");
  if (!data) throw new ReelDeliveryHttpError("Reel não encontrado.", 404);
  return data as DeliveryRow;
}

async function assertCanSee(db: SupabaseClient, actor: ScheduleActor, id: string): Promise<void> {
  if (isManager(actor)) return;
  const { data, error } = await db
    .from("reel_delivery_participants")
    .select("user_id")
    .eq("delivery_id", id)
    .eq("user_id", actor.profileId)
    .maybeSingle();
  if (error) throw new ReelDeliveryHttpError("Não foi possível validar seu acesso.");
  if (!data) throw new ReelDeliveryHttpError("Reel não encontrado.", 404);
}

async function signedUrl(db: SupabaseClient, path: string | null, download?: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db.storage
    .from(REEL_DELIVERIES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download } : undefined);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function downloadName(row: DeliveryRow, suffix: string, fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
  const base = `${row.due_date ?? ""} ${row.area} ${suffix}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return ext ? `${base}.${ext}` : base;
}

export async function getReelDelivery(id: string): Promise<ReelDeliveryDetail> {
  const actor = await requireContentScheduleActor();
  const db = adminDb();
  await assertCanSee(db, actor, id);
  const [row, people] = await Promise.all([loadDeliveryRow(db, id), loadPeople(db)]);
  const { summaries, versions, decisions } = await loadSummaries(db, [row], actor.profileId, people);
  const summary = summaries[0];
  const current = versions[0] ?? null;

  const [videoUrl, videoDownloadUrl, coverUrl, coverDownloadUrl] = await Promise.all([
    signedUrl(db, current?.video_path ?? null),
    current ? signedUrl(db, current.video_path, downloadName(row, `reel-v${current.version_number}`, current.file_name)) : null,
    signedUrl(db, row.cover_path),
    row.cover_path ? signedUrl(db, row.cover_path, downloadName(row, "capa", row.cover_path)) : null,
  ]);

  const { data: extraRow } = await db.from("reel_deliveries").select("transcript,cover_request_id").eq("id", id).maybeSingle();
  const coverRequest = await loadCoverRequest(db, (extraRow?.cover_request_id as string | null) ?? null);

  return {
    ...summary,
    transcript: (extraRow?.transcript as string | null) ?? null,
    coverRequest,
    versions: versions.map(toVersion),
    decisions: decisions.map(toDecision).reverse(),
    videoUrl,
    videoDownloadUrl,
    coverUrl,
    coverDownloadUrl,
  };
}

async function resolveParticipants(db: SupabaseClient, ids: string[]): Promise<ParticipantRow[]> {
  const unique = [...new Set(ids)];
  const { data, error } = await db
    .from("users")
    .select("id,name")
    .in("id", unique)
    .or("is_active.eq.true,is_active.is.null");
  if (error || !data || data.length !== unique.length) {
    throw new ReelDeliveryHttpError("Não foi possível localizar todas as pessoas selecionadas.", 400);
  }
  return data.map((u) => ({ delivery_id: "", user_id: u.id, user_name: u.name }));
}

async function assertUploadedObject(db: SupabaseClient, path: string): Promise<void> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await db.storage
    .from(REEL_DELIVERIES_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 5 });
  if (error || !data?.some((item) => item.name === path.slice(slash + 1))) {
    throw new ReelDeliveryHttpError("O arquivo não chegou ao armazenamento. Envie de novo.", 400);
  }
}

async function refreshStatus(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.rpc("refresh_reel_delivery_status", { p_delivery_id: id });
  if (error) throw new ReelDeliveryHttpError("Não foi possível atualizar o status do reel.");
}

export async function createReelDelivery(input: z.infer<typeof createReelDeliverySchema>): Promise<string> {
  const actor = await requireContentScheduleActor();
  requireManager(actor);
  const db = adminDb();
  if (!isDeliveryStoragePath(input.video.path, input.id)) {
    throw new ReelDeliveryHttpError("Caminho do vídeo inválido.", 400);
  }

  const { data: slot, error: slotError } = await db
    .from("content_schedule_slots")
    .select("id,area,due_date,format,cancelled")
    .eq("id", input.slot_id)
    .maybeSingle();
  if (slotError) throw new ReelDeliveryHttpError("Não foi possível validar a data do cronograma.");
  if (!slot || slot.format !== "reel" || slot.cancelled) {
    throw new ReelDeliveryHttpError("Escolha uma data de reel ativa do cronograma.", 400);
  }

  const [participants, name] = await Promise.all([
    resolveParticipants(db, input.participant_ids),
    actorName(db, actor),
    assertUploadedObject(db, input.video.path),
  ]);

  const { error: insertError } = await db.from("reel_deliveries").insert({
    id: input.id,
    slot_id: slot.id,
    area: slot.area,
    due_date: slot.due_date,
    created_by_id: actor.profileId,
    created_by_name: name,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      throw new ReelDeliveryHttpError("Essa data do cronograma já tem um reel enviado.", 409);
    }
    throw new ReelDeliveryHttpError("Não foi possível salvar o reel.");
  }

  const rollback = async () => {
    await db.from("reel_deliveries").delete().eq("id", input.id);
  };

  const { error: participantError } = await db
    .from("reel_delivery_participants")
    .insert(participants.map((p) => ({ ...p, delivery_id: input.id })));
  if (participantError) {
    await rollback();
    throw new ReelDeliveryHttpError("Não foi possível vincular as pessoas ao reel.");
  }

  const { error: versionError } = await db.from("reel_delivery_versions").insert({
    delivery_id: input.id,
    version_number: 1,
    video_path: input.video.path,
    file_name: input.video.file_name,
    size_bytes: input.video.size_bytes,
    content_type: input.video.content_type,
    notes: input.notes?.trim() || null,
    uploaded_by_id: actor.profileId,
    uploaded_by_name: name,
  });
  if (versionError) {
    await rollback();
    throw new ReelDeliveryHttpError("Não foi possível registrar o vídeo.");
  }
  await refreshStatus(db, input.id);
  return input.id;
}

export async function addReelVersion(id: string, input: z.infer<typeof addReelVersionSchema>): Promise<void> {
  const actor = await requireContentScheduleActor();
  requireManager(actor);
  const db = adminDb();
  await loadDeliveryRow(db, id);
  if (!isDeliveryStoragePath(input.video.path, id)) {
    throw new ReelDeliveryHttpError("Caminho do vídeo inválido.", 400);
  }
  await assertUploadedObject(db, input.video.path);

  const { data: last } = await db
    .from("reel_delivery_versions")
    .select("version_number")
    .eq("delivery_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const name = await actorName(db, actor);
  const { error } = await db.from("reel_delivery_versions").insert({
    delivery_id: id,
    version_number: (last?.version_number ?? 0) + 1,
    video_path: input.video.path,
    file_name: input.video.file_name,
    size_bytes: input.video.size_bytes,
    content_type: input.video.content_type,
    notes: input.notes?.trim() || null,
    uploaded_by_id: actor.profileId,
    uploaded_by_name: name,
  });
  if (error) {
    if (error.code === "23505") throw new ReelDeliveryHttpError("Outra versão acabou de ser enviada. Atualize a página.", 409);
    throw new ReelDeliveryHttpError("Não foi possível registrar a nova versão.");
  }
  // Versão nova volta para aprovação, mesmo que o reel já estivesse pronto.
  const { error: resetError } = await db
    .from("reel_deliveries")
    .update({ status: "awaiting_approval", ready_at: null, published_at: null })
    .eq("id", id);
  if (resetError) throw new ReelDeliveryHttpError("Não foi possível reabrir a aprovação.");
  await refreshStatus(db, id);
}

export async function decideReelDelivery(id: string, input: z.infer<typeof reelDecisionSchema>): Promise<void> {
  const actor = await requireContentScheduleActor();
  const db = adminDb();
  const row = await loadDeliveryRow(db, id);
  if (!canParticipantDecide(row.status)) {
    throw new ReelDeliveryHttpError("Esse reel já seguiu para publicação.", 409);
  }

  const targetUserId = input.on_behalf_of ?? actor.profileId;
  if (input.on_behalf_of && input.on_behalf_of !== actor.profileId) requireManager(actor);

  const { data: participant, error: participantError } = await db
    .from("reel_delivery_participants")
    .select("user_id,user_name")
    .eq("delivery_id", id)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (participantError) throw new ReelDeliveryHttpError("Não foi possível validar a aprovação.");
  if (!participant) throw new ReelDeliveryHttpError("Só quem aparece no vídeo pode aprovar.", 403);

  const { data: current } = await db
    .from("reel_delivery_versions")
    .select("id")
    .eq("delivery_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!current || current.id !== input.version_id) {
    throw new ReelDeliveryHttpError("Chegou uma versão mais nova do vídeo. Assista antes de decidir.", 409);
  }

  const { error } = await db.from("reel_delivery_decisions").upsert(
    {
      delivery_id: id,
      version_id: current.id,
      user_id: participant.user_id,
      user_name: participant.user_name,
      decision: input.decision,
      comment: input.comment?.trim() || null,
      recorded_by_id: actor.profileId,
      recorded_by_name: targetUserId === actor.profileId ? participant.user_name : await actorName(db, actor),
      created_at: new Date().toISOString(),
    },
    { onConflict: "version_id,user_id" }
  );
  if (error) throw new ReelDeliveryHttpError("Não foi possível registrar sua decisão.");
  await refreshStatus(db, id);
}

export async function updateReelDelivery(id: string, input: z.infer<typeof updateReelDeliverySchema>): Promise<void> {
  const actor = await requireContentScheduleActor();
  requireManager(actor);
  const db = adminDb();
  const row = await loadDeliveryRow(db, id);

  if (input.cover_path && !isDeliveryStoragePath(input.cover_path, id)) {
    throw new ReelDeliveryHttpError("Caminho da capa inválido.", 400);
  }
  if (input.cover_path) await assertUploadedObject(db, input.cover_path);

  const updates: Record<string, unknown> = {};
  const clean = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);
  if (input.cover_title !== undefined) updates.cover_title = clean(input.cover_title);
  if (input.cover_subtitle !== undefined) updates.cover_subtitle = clean(input.cover_subtitle);
  if (input.caption !== undefined) updates.caption = input.caption?.trim() ? input.caption.trim() : null;
  if (input.cover_path !== undefined) updates.cover_path = input.cover_path;

  if (input.status) {
    const next = {
      caption: (updates.caption as string | null | undefined) ?? row.caption,
      coverPath: (updates.cover_path as string | null | undefined) ?? row.cover_path,
    };
    if (input.status === "ready" || input.status === "published") {
      const missing = missingForReady({ status: row.status, ...next });
      if (missing.length) throw new ReelDeliveryHttpError(`Falta ${missing.join(", ")}.`, 409);
    }
    if (input.status === "approved" && row.status !== "ready" && row.status !== "published") {
      throw new ReelDeliveryHttpError("Só dá para voltar para capa e legenda depois de pronto.", 409);
    }
    updates.status = input.status;
    if (input.status === "ready") updates.ready_at = row.ready_at ?? new Date().toISOString();
    if (input.status === "published") {
      updates.ready_at = row.ready_at ?? new Date().toISOString();
      updates.published_at = new Date().toISOString();
    }
    if (input.status === "approved") {
      updates.ready_at = null;
      updates.published_at = null;
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await db.from("reel_deliveries").update(updates).eq("id", id);
    if (error) throw new ReelDeliveryHttpError("Não foi possível salvar o reel.");
  }

  if (input.cover_path !== undefined && row.cover_path && row.cover_path !== input.cover_path) {
    await db.storage.from(REEL_DELIVERIES_BUCKET).remove([row.cover_path]);
  }

  if (input.participant_ids) {
    const participants = await resolveParticipants(db, input.participant_ids);
    const { error: deleteError } = await db.from("reel_delivery_participants").delete().eq("delivery_id", id);
    if (deleteError) throw new ReelDeliveryHttpError("Não foi possível atualizar as pessoas.");
    const { error: insertError } = await db
      .from("reel_delivery_participants")
      .insert(participants.map((p) => ({ ...p, delivery_id: id })));
    if (insertError) throw new ReelDeliveryHttpError("Não foi possível atualizar as pessoas.");
    await refreshStatus(db, id);
  }
}

export async function deleteReelDelivery(id: string): Promise<void> {
  const actor = await requireContentScheduleActor();
  requireManager(actor);
  const db = adminDb();
  const row = await loadDeliveryRow(db, id);
  const { data: versions } = await db.from("reel_delivery_versions").select("video_path").eq("delivery_id", id);
  const paths = [...(versions ?? []).map((v) => v.video_path as string), row.cover_path].filter(Boolean) as string[];
  const { error } = await db.from("reel_deliveries").delete().eq("id", id);
  if (error) throw new ReelDeliveryHttpError("Não foi possível excluir o reel.");
  if (paths.length) await db.storage.from(REEL_DELIVERIES_BUCKET).remove(paths);
}

async function loadCoverRequest(db: SupabaseClient, requestId: string | null): Promise<ReelCoverRequest | null> {
  if (!requestId) return null;
  const { data } = await db
    .from("marketing_requests")
    .select("id,workflow_stage,assignee,deadline,art_image_path")
    .eq("id", requestId)
    .maybeSingle();
  if (!data) return null;
  const stage = (data.workflow_stage as string | null) ?? "tarefas";
  return {
    id: data.id as string,
    stage,
    stageLabel: WORKFLOW_STAGES.find((item) => item.value === stage)?.label ?? stage,
    assigneeName: (data.assignee as string | null) ?? null,
    deadline: (data.deadline as string | null) ?? null,
    hasImage: Boolean(data.art_image_path),
  };
}

/** Quem aparece no vídeo, com nome completo, cargo e área do RH. */
async function loadCoverPeople(db: SupabaseClient, deliveryId: string): Promise<ReelCoverPerson[]> {
  const { data: participants } = await db
    .from("reel_delivery_participants")
    .select("user_id,user_name")
    .eq("delivery_id", deliveryId)
    .order("created_at");
  const ids = (participants ?? []).map((p) => p.user_id as string);
  const { data: employees } = ids.length
    ? await db.from("hr_employees").select("user_id,gender,position,department").in("user_id", ids)
    : { data: [] };
  const byUser = new Map((employees ?? []).map((e) => [e.user_id as string, e]));
  return (participants ?? []).map((p) => {
    const employee = byUser.get(p.user_id as string);
    const department = (employee?.department as string | null) ?? null;
    // "Sócio" é cadastro de sócio, não área: usa a área do reel.
    const area = department && !/^s[oó]ci/i.test(department.trim()) ? resolveContentScheduleAreaLabel(department) : null;
    return {
      name: p.user_name as string,
      gender: (employee?.gender as string | null) ?? null,
      position: (employee?.position as string | null) ?? null,
      area,
    };
  });
}

/**
 * Cria a tarefa "Capa de Reels" no Planner para a designer, com título, subtítulo
 * e quem aparece no vídeo. A imagem que ela subir vira a capa quando a tarefa
 * for aprovada (gatilho apply_reel_cover_from_request).
 */
export async function requestReelCover(id: string): Promise<void> {
  const actor = await requireContentScheduleActor();
  requireManager(actor);
  const db = adminDb();
  const row = await loadDeliveryRow(db, id);
  if (!row.cover_title?.trim()) {
    throw new ReelDeliveryHttpError("Escreva ou gere o título da capa antes de pedir a arte.", 409);
  }

  const { data: current } = await db.from("reel_deliveries").select("cover_request_id").eq("id", id).maybeSingle();
  const existing = await loadCoverRequest(db, (current?.cover_request_id as string | null) ?? null);
  if (existing && existing.stage !== "concluido") {
    throw new ReelDeliveryHttpError("Já existe uma tarefa de capa aberta no Planner para este reel.", 409);
  }

  const { data: designers } = await db
    .from("users")
    .select("id,name")
    .eq("role", "designer")
    .or("is_active.eq.true,is_active.is.null")
    .order("name")
    .limit(1);
  const designer = designers?.[0] ?? null;

  const { data: actorRow } = await db.from("users").select("id,name").eq("id", actor.profileId).maybeSingle();
  const coverPeople = await loadCoverPeople(db, id);
  const people = coverPeople.map((person) => person.name).join(", ");
  const description = buildCoverRequestDescription({
    coverTitle: row.cover_title,
    coverSubtitle: row.cover_subtitle,
    people: coverPeople,
    area: row.area,
  });

  const { data: created, error } = await db
    .from("marketing_requests")
    .insert({
      title: `Capa de Reels: ${row.cover_title.trim()}`,
      description,
      requesting_area: row.area,
      request_type: REEL_COVER_REQUEST_TYPE,
      status: "pending",
      workflow_stage: "tarefas",
      priority: "normal",
      requested_at: new Date().toISOString(),
      deadline: addBusinessDaysYmd(currentSaoPauloDate(), REEL_COVER_SLA_BUSINESS_DAYS),
      assignee: designer?.name ?? null,
      assignee_id: designer?.id ?? null,
      solicitante: actorRow?.name ?? null,
      solicitante_id: actor.profileId,
      created_by: actorRow?.name ?? null,
      created_by_id: actor.profileId,
      nome_advogado: people,
      reel_delivery_id: id,
    })
    .select("id")
    .single();
  if (error || !created) throw new ReelDeliveryHttpError("Não foi possível criar a tarefa no Planner.");

  const { error: linkError } = await db.from("reel_deliveries").update({ cover_request_id: created.id }).eq("id", id);
  if (linkError) {
    await db.from("marketing_requests").delete().eq("id", created.id);
    throw new ReelDeliveryHttpError("Não foi possível ligar a tarefa ao reel.");
  }
}

function openAiKey(): string {
  const key = process.env.NEXT_OPENAI_API_KEY?.trim();
  if (!key) throw new ReelDeliveryHttpError("A chave de IA não está configurada.", 503);
  return key;
}

async function transcribeAudio(db: SupabaseClient, path: string): Promise<string> {
  const { data: blob, error } = await db.storage.from(REEL_DELIVERIES_BUCKET).download(path);
  if (error || !blob) throw new ReelDeliveryHttpError("O áudio do vídeo não chegou ao armazenamento.", 400);
  if (blob.size > REEL_AUDIO_MAX_BYTES) throw new ReelDeliveryHttpError("O áudio é longo demais para transcrever.", 413);

  const form = new FormData();
  form.append("file", new File([blob], "reel.wav", { type: "audio/wav" }));
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1");
  form.append("language", "pt");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey()}` },
    body: form,
  });
  const json = (await response.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
  if (!response.ok) throw new ReelDeliveryHttpError(json.error?.message ?? "A transcrição falhou.", 502);
  return (json.text ?? "").trim();
}

async function creditLine(db: SupabaseClient, deliveryId: string, area: string): Promise<string> {
  const { data: participants } = await db
    .from("reel_delivery_participants")
    .select("user_id,user_name")
    .eq("delivery_id", deliveryId)
    .order("created_at");
  const ids = (participants ?? []).map((p) => p.user_id as string);
  const { data: employees } = ids.length
    ? await db.from("hr_employees").select("user_id,gender,position,oab_number").in("user_id", ids)
    : { data: [] };
  const byUser = new Map((employees ?? []).map((e) => [e.user_id as string, e]));
  return reelCreditLine(
    (participants ?? []).map((p) => {
      const employee = byUser.get(p.user_id as string);
      return {
        name: p.user_name as string,
        gender: (employee?.gender as string | null) ?? null,
        position: (employee?.position as string | null) ?? null,
        oab: (employee?.oab_number as string | null) ?? null,
      };
    }),
    area
  );
}

/**
 * Transcreve o áudio extraído no navegador (ou reaproveita a transcrição salva) e
 * escreve título, subtítulo e legenda pelo guia editorial. Sem `overwrite`, só
 * preenche o que ainda estiver vazio.
 */
export async function generateReelCopy(id: string, input: z.infer<typeof reelCopyRequestSchema>): Promise<void> {
  const actor = await requireContentScheduleActor();
  requireManager(actor);
  const db = adminDb();
  const row = await loadDeliveryRow(db, id);
  if (input.audio_path && !(isDeliveryStoragePath(input.audio_path, id) && /\/audio-[^/]+\.wav$/.test(input.audio_path))) {
    throw new ReelDeliveryHttpError("Caminho do áudio inválido.", 400);
  }

  await db.from("reel_deliveries")
    .update({ ai_status: "processing", ai_error: null, ai_updated_at: new Date().toISOString() })
    .eq("id", id);

  try {
    let transcript: string | null = null;
    if (input.audio_path) {
      try {
        transcript = await transcribeAudio(db, input.audio_path);
      } finally {
        await db.storage.from(REEL_DELIVERIES_BUCKET).remove([input.audio_path]);
      }
      await db.from("reel_deliveries").update({ transcript: transcript || null }).eq("id", id);
    } else {
      const { data } = await db.from("reel_deliveries").select("transcript").eq("id", id).maybeSingle();
      transcript = (data?.transcript as string | null) ?? null;
    }
    if (!transcript || transcript.length < 40) {
      throw new ReelDeliveryHttpError("Não deu para entender a fala do vídeo. Escreva título e legenda à mão.", 422);
    }

    const credit = await creditLine(db, id, row.area);
    const result = await generateObject({
      model: createOpenAI({ apiKey: openAiKey() })(process.env.OPENAI_REELS_MODEL ?? "gpt-5.6-terra"),
      schema: reelCopySchema,
      schemaName: "capa_e_legenda_reel",
      system: REEL_COPY_PROMPT,
      prompt: `Área: ${row.area}\nLinha de crédito (use exatamente): ${credit}\n\nTranscrição do vídeo:\n${transcript}`,
    });

    const fresh = await loadDeliveryRow(db, id);
    const keep = (current: string | null) => !input.overwrite && Boolean(current?.trim());
    const { error } = await db.from("reel_deliveries").update({
      cover_title: keep(fresh.cover_title) ? fresh.cover_title : stripDashes(result.object.titulo.trim()),
      cover_subtitle: keep(fresh.cover_subtitle) ? fresh.cover_subtitle : stripDashes(result.object.subtitulo.trim()),
      caption: keep(fresh.caption) ? fresh.caption : stripDashes(result.object.legenda.trim()),
      ai_status: "done",
      ai_error: null,
      ai_updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw new ReelDeliveryHttpError("Não foi possível salvar o texto gerado.");
  } catch (error) {
    const message = error instanceof ReelDeliveryHttpError ? error.message : "A IA não conseguiu gerar o texto agora.";
    console.error("[reel-deliveries/ai]", error);
    await db.from("reel_deliveries")
      .update({ ai_status: "failed", ai_error: message, ai_updated_at: new Date().toISOString() })
      .eq("id", id);
    throw error instanceof ReelDeliveryHttpError ? error : new ReelDeliveryHttpError(message, 502);
  }
}

export function toReelDeliveryApiError(error: unknown): { message: string; status: number } {
  if (error instanceof ReelDeliveryHttpError) return { message: error.message, status: error.status };
  if (error && typeof error === "object" && "status" in error && "message" in error) {
    const status = Number((error as { status: unknown }).status);
    if (status >= 400 && status < 600) return { message: String((error as { message: unknown }).message), status };
  }
  return { message: "Erro inesperado na aprovação de reels.", status: 500 };
}
