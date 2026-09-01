import { GustavoContentError } from "@/lib/gustavo-content/errors";
import { getGustavoContentAdmin } from "@/lib/gustavo-content/server";
import {
  thesisSnapshot,
  validateThesisInput,
  type GustavoThesis,
  type ThesisInput,
} from "@/lib/gustavo-content/theses";

const THESIS_SELECT =
  "id, title, thesis, explanation, business_importance, counterpoint, applications, tags, conviction, status, gustavo_phrases, usage_count, last_used_at, created_by, updated_by, created_at, updated_at";

export async function listTheses(): Promise<GustavoThesis[]> {
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_theses")
    .select(THESIS_SELECT)
    .order("updated_at", { ascending: false });
  if (error) throw new GustavoContentError(error.message, 500);
  return (data ?? []) as GustavoThesis[];
}

export async function createThesis(
  input: ThesisInput,
  actorId: string
): Promise<GustavoThesis> {
  const parsed = validateThesisInput(input);
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_theses")
    .insert({
      ...parsed,
      created_by: actorId,
      updated_by: actorId,
    })
    .select(THESIS_SELECT)
    .single();
  if (error || !data) {
    throw new GustavoContentError(error?.message ?? "Não foi possível criar a tese.", 500);
  }
  return data as GustavoThesis;
}

export async function updateThesis(
  id: string,
  input: ThesisInput,
  actorId: string
): Promise<GustavoThesis> {
  if (!id) throw new GustavoContentError("id é obrigatório.", 400);
  const parsed = validateThesisInput(input);
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_theses")
    .update({ ...parsed, updated_by: actorId })
    .eq("id", id)
    .select(THESIS_SELECT)
    .maybeSingle();
  if (error) throw new GustavoContentError(error.message, 500);
  if (!data) throw new GustavoContentError("Tese não encontrada.", 404);
  return data as GustavoThesis;
}

export async function createContentFromThesis(
  thesisId: string,
  actor: { id: string; name: string }
): Promise<{ itemId: string }> {
  const admin = getGustavoContentAdmin();
  const { data: thesis, error: fetchError } = await admin
    .from("gustavo_content_theses")
    .select(THESIS_SELECT)
    .eq("id", thesisId)
    .maybeSingle();
  if (fetchError) throw new GustavoContentError(fetchError.message, 500);
  if (!thesis) throw new GustavoContentError("Tese não encontrada.", 404);
  if (thesis.status === "disabled") {
    throw new GustavoContentError(
      "Não é possível criar conteúdo a partir de uma tese desativada.",
      400
    );
  }

  const row = thesis as GustavoThesis;
  const { data: item, error: insertError } = await admin
    .from("gustavo_content_items")
    .insert({
      source: "thesis",
      title: row.title,
      thesis_id: row.id,
      thesis_snapshot: thesisSnapshot(row),
      opinion_status: row.status === "validated" ? "validated" : "needs_gustavo",
      status: "sugestao",
      created_by: actor.id,
      created_by_name: actor.name,
    })
    .select("id")
    .single();
  if (insertError || !item) {
    throw new GustavoContentError(
      insertError?.message ?? "Não foi possível criar o conteúdo.",
      500
    );
  }

  await admin
    .from("gustavo_content_theses")
    .update({
      usage_count: row.usage_count + 1,
      last_used_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .eq("id", row.id);

  return { itemId: item.id as string };
}
