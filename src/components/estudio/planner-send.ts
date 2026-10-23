import { supabase } from "@/utils/supabase/client";
import { getTitleTag } from "@/lib/planner-title-tag";
import { uploadRequestFile } from "@/lib/request-files/client";
import { nextPieceCode, plannerChecklist, slideFileName } from "@/lib/estudio/domain";
import type { PieceKind, StudioSlide } from "@/lib/estudio/types";

export interface TagRequest {
  id: string;
  title: string;
  workflow_stage: string | null;
  requesting_area: string;
  solicitante: string | null;
  solicitante_id: string | null;
  link: string | null;
  requested_at: string;
}

const REQUEST_COLUMNS = "id, title, workflow_stage, requesting_area, solicitante, solicitante_id, link, requested_at";

/** Solicitações do planner com a tag no título (mais recentes primeiro). */
export async function fetchTagRequests(tag: string): Promise<TagRequest[]> {
  const like = tag.replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data, error } = await supabase
    .from("marketing_requests")
    .select(REQUEST_COLUMNS)
    .ilike("title", `%[${like}]%`)
    .order("requested_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as solicitações da campanha.");
  return ((data ?? []) as TagRequest[]).filter((r) => getTitleTag(r.title)?.tag === tag);
}

/**
 * Tarefas de post em aberto (as que o Gerador cria ao mandar o post ao Marketing),
 * com a tarefa ligada à peça sempre na lista.
 */
export async function fetchOpenPostRequests(linkedId: string | null): Promise<TagRequest[]> {
  const { data, error } = await supabase
    .from("marketing_requests")
    .select(REQUEST_COLUMNS)
    .eq("request_type", "Post Redes Sociais")
    .neq("workflow_stage", "concluido")
    .order("requested_at", { ascending: false })
    .limit(60);
  if (error) throw new Error("Não foi possível carregar as tarefas de post.");
  const list = ((data ?? []) as TagRequest[]).filter((r) => !getTitleTag(r.title) && r.id !== linkedId);
  if (linkedId) {
    // primeiro da lista: é dela que uma solicitação nova copia área, solicitante e link
    const { data: linked } = await supabase.from("marketing_requests").select(REQUEST_COLUMNS).eq("id", linkedId).maybeSingle();
    if (linked) list.unshift(linked as TagRequest);
  }
  return list;
}

export function suggestCode(requests: TagRequest[], tag: string, kind: PieceKind): string {
  return nextPieceCode(requests.map((r) => r.title), tag, kind);
}

interface SendInput {
  tag: string;
  kind: PieceKind;
  slides: StudioSlide[];
  legenda: string;
  files: Blob[];
  user: { id: string; name: string };
}

async function uploadAll(requestId: string, kind: PieceKind, files: Blob[], userId: string, startAt: number) {
  for (let i = 0; i < files.length; i++) {
    const file = new File([files[i]], slideFileName(kind, i), { type: "image/png" });
    await uploadRequestFile(requestId, file, { sortOrder: startAt + i, uploadedById: userId });
  }
}

/**
 * Cria a solicitação da peça no planner (título no padrão da campanha, em revisão,
 * com o texto de cada slide no checklist) e sobe as artes. A área, o solicitante e
 * o link vêm da solicitação mais recente da mesma tag.
 */
export async function sendAsNewRequest(input: SendInput & { title: string; deadline: string | null; requests: TagRequest[] }): Promise<string> {
  const base = input.requests[0];
  const { data, error } = await supabase
    .from("marketing_requests")
    .insert({
      title: input.title,
      description: `Peça criada no Estúdio de peças (${input.files.length} ${input.files.length === 1 ? "arte" : "artes"}).`,
      requesting_area: base?.requesting_area ?? "Institucional",
      solicitante: base?.solicitante ?? input.user.name,
      solicitante_id: base?.solicitante_id ?? input.user.id,
      link: base?.link ?? null,
      request_type: "Post Redes Sociais",
      status: "pending",
      workflow_stage: "revisao",
      priority: "normal",
      assignee: input.user.name,
      assignee_id: input.user.id,
      deadline: input.deadline || null,
      created_by: input.user.name,
      created_by_id: input.user.id,
      stage_changed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível criar a solicitação no planner.");
  const requestId = data.id as string;

  const checklist = plannerChecklist(input.kind, input.slides, input.legenda).map((item, index) => ({
    request_id: requestId,
    label: item.label,
    content: item.content || null,
    sort_order: index,
  }));
  if (checklist.length) {
    const { error: checklistError } = await supabase.from("marketing_request_checklist_items").insert(checklist);
    if (checklistError) throw new Error("A solicitação foi criada, mas o checklist com os textos falhou.");
  }

  await uploadAll(requestId, input.kind, input.files, input.user.id, 0);
  return requestId;
}

/** Anexa as artes a uma solicitação que já existe (depois dos arquivos que ela tem). */
export async function attachToRequest(requestId: string, input: Pick<SendInput, "kind" | "files" | "user">): Promise<void> {
  const { count } = await supabase
    .from("marketing_request_files")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);
  await uploadAll(requestId, input.kind, input.files, input.user.id, count ?? 0);
}
