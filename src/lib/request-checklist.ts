import { supabase } from "@/utils/supabase/client";

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
  completed_at: string | null;
  completed_by_id: string | null;
  created_at: string;
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
    .select("id, request_id, label, sort_order, completed_at, completed_by_id, created_at")
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
