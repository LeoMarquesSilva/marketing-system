import { supabase } from "@/utils/supabase/client";
import { REEL_REQUEST_TYPE } from "@/lib/planner-posts";
import { LEONARDO_USER_ID } from "@/lib/planner-visibility";

export const REEL_CHECKLIST_CONFIG = [
  {
    label: "Criação capa",
    contentType: "media" as const,
    placeholder: "Envie a imagem da capa (JPG, PNG ou WebP)",
    accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
  },
  {
    label: "Criação Legenda",
    contentType: "text" as const,
    placeholder: "Texto da legenda para publicação",
  },
  {
    label: "Mensagem para o grupo da equipe",
    contentType: "text" as const,
    placeholder: "Mensagem para enviar no grupo da equipe",
  },
] as const;

export const REEL_CHECKLIST_ITEMS = REEL_CHECKLIST_CONFIG.map((item) => item.label);
export const REEL_LEONARDO_STAGE = "tarefas_leonardo";
export const REEL_LEONARDO_NAME = "Leonardo Marques";

export const ONBOARDING_CHECKLIST_ITEMS = [
  "Montar arte de boas-vindas",
  "Wallpaper para fundo do webcam",
  "Assinatura de e-mail",
  "Atualização PPT Onboarding",
  "Wallpaper área de trabalho",
] as const;

export const ONBOARDING_REQUEST_TYPE = "Onboarding";
export const ONBOARDING_REQUESTING_AREA = "Institucional";
export const ONBOARDING_SOLICITANTE = "Escritório";

export interface ChecklistItem {
  id: string;
  request_id: string;
  label: string;
  sort_order: number;
  content: string | null;
  completed_at: string | null;
  completed_by_id: string | null;
  created_at: string;
}

export type ReelChecklistFieldConfig = (typeof REEL_CHECKLIST_CONFIG)[number];

export const REEL_COVER_CHECKLIST_LABEL = REEL_CHECKLIST_CONFIG[0].label;
export const REEL_CAPTION_CHECKLIST_LABEL = REEL_CHECKLIST_CONFIG[1].label;
export const REEL_TEAM_MESSAGE_CHECKLIST_LABEL = REEL_CHECKLIST_CONFIG[2].label;

export function getReelChecklistContent(items: ChecklistItem[], label: string): string | null {
  return items.find((item) => item.label === label)?.content?.trim() || null;
}

export interface ReelPublicationAssets {
  coverUrl: string | null;
  caption: string | null;
  teamMessage: string | null;
}

export function getReelPublicationAssets(items: ChecklistItem[]): ReelPublicationAssets {
  return {
    coverUrl: getReelChecklistContent(items, REEL_COVER_CHECKLIST_LABEL),
    caption: getReelChecklistContent(items, REEL_CAPTION_CHECKLIST_LABEL),
    teamMessage: getReelChecklistContent(items, REEL_TEAM_MESSAGE_CHECKLIST_LABEL),
  };
}

export function getReelChecklistFieldConfig(label: string): ReelChecklistFieldConfig | null {
  return REEL_CHECKLIST_CONFIG.find((item) => item.label === label) ?? null;
}

export function reelChecklistItemRequiresContent(label: string): boolean {
  return getReelChecklistFieldConfig(label) != null;
}

export interface ChecklistStats {
  checklistTotals: Record<string, number>;
  checklistCompleted: Record<string, number>;
}

export async function fetchChecklistForRequest(
  requestId: string
): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("marketing_request_checklist_items")
    .select("id, request_id, label, sort_order, content, completed_at, completed_by_id, created_at")
    .eq("request_id", requestId)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as ChecklistItem[];
}

export async function fetchChecklistStats(
  requestIds: string[]
): Promise<ChecklistStats> {
  const empty: ChecklistStats = {
    checklistTotals: {},
    checklistCompleted: {},
  };
  if (requestIds.length === 0) return empty;

  const { data, error } = await supabase
    .from("marketing_request_checklist_items")
    .select("request_id, completed_at")
    .in("request_id", requestIds);

  if (error) return empty;

  for (const id of requestIds) {
    empty.checklistTotals[id] = 0;
    empty.checklistCompleted[id] = 0;
  }

  for (const row of data ?? []) {
    const id = row.request_id as string;
    empty.checklistTotals[id] = (empty.checklistTotals[id] ?? 0) + 1;
    if (row.completed_at) {
      empty.checklistCompleted[id] = (empty.checklistCompleted[id] ?? 0) + 1;
    }
  }

  return empty;
}

export async function toggleChecklistItem(
  itemId: string,
  completed: boolean,
  userId: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("marketing_request_checklist_items")
    .update({
      completed_at: completed ? new Date().toISOString() : null,
      completed_by_id: completed ? userId : null,
    })
    .eq("id", itemId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function updateChecklistItemContent(
  itemId: string,
  content: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("marketing_request_checklist_items")
    .update({ content: content.trim() || null })
    .eq("id", itemId);

  if (error) return { error: error.message };
  return { error: null };
}

function reelChecklistItemsReady(items: ChecklistItem[]): boolean {
  return getReelChecklistProgress(items).ready;
}

export function getReelChecklistProgress(items: ChecklistItem[]): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  for (const item of items) {
    if (!item.completed_at) {
      missing.push(item.label);
      continue;
    }
    if (reelChecklistItemRequiresContent(item.label) && !item.content?.trim()) {
      missing.push(`${item.label} (preencher conteúdo)`);
    }
  }
  return { ready: missing.length === 0, missing };
}

/** Envia reel concluído para o banco de conteúdo (aba Posts). */
export async function completeReelToContentBank(
  requestId: string,
  items?: ChecklistItem[]
): Promise<{ error: string | null }> {
  const checklistItems = items ?? (await fetchChecklistForRequest(requestId));
  if (checklistItems.length === 0) {
    return { error: "Checklist do reel não encontrado." };
  }

  const progress = getReelChecklistProgress(checklistItems);
  if (!progress.ready) {
    return {
      error: `Complete o checklist antes: ${progress.missing.join(", ")}.`,
    };
  }

  const { promoted, error } = await promoteReelToContentBankIfReady(requestId, checklistItems);
  if (error) return { error };
  if (!promoted) {
    return { error: "Não foi possível enviar para o banco de conteúdo." };
  }
  return { error: null };
}

/** Quando o checklist do reel estiver completo, move a solicitação para o banco de conteúdo. */
export async function promoteReelToContentBankIfReady(
  requestId: string,
  knownItems?: ChecklistItem[]
): Promise<{ promoted: boolean; error: string | null }> {
  const items = knownItems ?? (await fetchChecklistForRequest(requestId));
  if (items.length === 0 || !reelChecklistItemsReady(items)) {
    return { promoted: false, error: null };
  }

  const { data: request, error: fetchError } = await supabase
    .from("marketing_requests")
    .select("request_type, workflow_stage")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) return { promoted: false, error: fetchError.message };
  if (
    request?.request_type !== REEL_REQUEST_TYPE ||
    request?.workflow_stage !== REEL_LEONARDO_STAGE
  ) {
    return { promoted: false, error: null };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("marketing_requests")
    .update({
      workflow_stage: "concluido",
      completion_type: "design_concluido",
      status: "completed",
      delivered_at: now,
      stage_changed_at: now,
    })
    .eq("id", requestId);

  if (updateError) return { promoted: false, error: updateError.message };
  return { promoted: true, error: null };
}

export interface CreateOnboardingRequestInput {
  collaboratorName: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  deadline?: string | null;
  deadlineTime?: string | null;
  notes?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
}

export async function createOnboardingRequest(
  input: CreateOnboardingRequestInput
): Promise<{ error: string | null; requestId?: string }> {
  const name = input.collaboratorName.trim();
  if (!name) return { error: "Informe o nome do colaborador." };

  const title = `Onboarding — ${name}`;
  const descriptionParts = [
    `Pacote de boas-vindas para novo colaborador: ${name}.`,
    input.notes?.trim() ? `Observações: ${input.notes.trim()}` : null,
  ].filter(Boolean);

  const { data: inserted, error: insertErr } = await supabase
    .from("marketing_requests")
    .insert({
      title,
      description: descriptionParts.join("\n\n"),
      requesting_area: ONBOARDING_REQUESTING_AREA,
      status: "pending",
      workflow_stage: "tarefas",
      request_type: ONBOARDING_REQUEST_TYPE,
      solicitante: ONBOARDING_SOLICITANTE,
      priority: "normal",
      assignee: input.assigneeName ?? null,
      assignee_id: input.assigneeId ?? null,
      deadline: input.deadline || null,
      deadline_time: input.deadlineTime || null,
      created_by_id: input.createdById ?? null,
      created_by: input.createdByName ?? null,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };

  const checklistRows = ONBOARDING_CHECKLIST_ITEMS.map((label, index) => ({
    request_id: inserted.id,
    label,
    sort_order: index,
  }));

  const { error: checklistErr } = await supabase
    .from("marketing_request_checklist_items")
    .insert(checklistRows);

  if (checklistErr) {
    await supabase.from("marketing_requests").delete().eq("id", inserted.id);
    return { error: checklistErr.message };
  }

  return { error: null, requestId: inserted.id };
}

export interface CreateReelRequestInput {
  title: string;
  videoUrl: string;
  requestingArea: string;
  deadline?: string | null;
  deadlineTime?: string | null;
  notes?: string | null;
  solicitanteId?: string | null;
  solicitante?: string | null;
  nomeAdvogado?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
}

export async function createReelRequest(
  input: CreateReelRequestInput
): Promise<{ error: string | null; requestId?: string }> {
  const name = input.title.trim();
  if (!name) return { error: "Informe o título do reel." };
  if (!input.videoUrl.trim()) return { error: "Informe o vídeo do reel." };

  const title = `Reel — ${name}`;
  const descriptionParts = [
    `Reel gravado: ${name}.`,
    input.notes?.trim() ? `Observações: ${input.notes.trim()}` : null,
  ].filter(Boolean);

  const { data: inserted, error: insertErr } = await supabase
    .from("marketing_requests")
    .insert({
      title,
      description: descriptionParts.join("\n\n"),
      requesting_area: input.requestingArea.trim() || "Geral",
      status: "pending",
      workflow_stage: REEL_LEONARDO_STAGE,
      request_type: REEL_REQUEST_TYPE,
      priority: "normal",
      assignee_id: LEONARDO_USER_ID,
      assignee: REEL_LEONARDO_NAME,
      solicitante_id: input.solicitanteId ?? null,
      solicitante: input.solicitante ?? null,
      nome_advogado: input.nomeAdvogado ?? input.solicitante ?? null,
      art_link: input.videoUrl,
      reels_metadata: {
        video_url: input.videoUrl,
        uploaded_at: new Date().toISOString(),
      },
      deadline: input.deadline || null,
      deadline_time: input.deadlineTime || null,
      created_by_id: input.createdById ?? null,
      created_by: input.createdByName ?? null,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };

  const checklistRows = REEL_CHECKLIST_CONFIG.map((item, index) => ({
    request_id: inserted.id,
    label: item.label,
    sort_order: index,
    content: null,
  }));

  const { error: checklistErr } = await supabase
    .from("marketing_request_checklist_items")
    .insert(checklistRows);

  if (checklistErr) {
    await supabase.from("marketing_requests").delete().eq("id", inserted.id);
    return { error: checklistErr.message };
  }

  return { error: null, requestId: inserted.id };
}
