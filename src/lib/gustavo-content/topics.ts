import { GustavoContentError } from "@/lib/gustavo-content/errors";
import { getGustavoContentAdmin } from "@/lib/gustavo-content/server";
import type { GustavoContentTopic } from "@/lib/gustavo-content/types";

const TOPIC_SELECT =
  "id, name, rss_query, is_active, months_back, item_limit, priority, created_at, updated_at";

export async function listTopics(): Promise<GustavoContentTopic[]> {
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_topics")
    .select(TOPIC_SELECT)
    .order("priority", { ascending: false });
  if (error) throw new GustavoContentError(error.message, 500);
  return (data ?? []) as GustavoContentTopic[];
}

export function validateTopicInput(input: Record<string, unknown>) {
  const name = String(input.name ?? "").trim();
  const rss_query = String(input.rss_query ?? "").trim();
  if (!name) throw new GustavoContentError("Informe o nome do tema.", 400);
  if (!rss_query) throw new GustavoContentError("Informe a query RSS.", 400);
  return {
    name,
    rss_query,
    is_active: input.is_active !== false,
    months_back: Number(input.months_back ?? 4) || 4,
    item_limit: Number(input.item_limit ?? 20) || 20,
    priority: Number(input.priority ?? 0) || 0,
  };
}

export async function createTopic(input: Record<string, unknown>): Promise<GustavoContentTopic> {
  const parsed = validateTopicInput(input);
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_topics")
    .insert(parsed)
    .select(TOPIC_SELECT)
    .single();
  if (error || !data) {
    throw new GustavoContentError(error?.message ?? "Não foi possível criar o tema.", 500);
  }
  return data as GustavoContentTopic;
}

export async function updateTopic(
  id: string,
  input: Record<string, unknown>
): Promise<GustavoContentTopic> {
  if (!id) throw new GustavoContentError("id é obrigatório.", 400);
  const admin = getGustavoContentAdmin();
  const { data: current } = await admin
    .from("gustavo_content_topics")
    .select(TOPIC_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new GustavoContentError("Tema não encontrado.", 404);

  const parsed = validateTopicInput({
    name: input.name ?? current.name,
    rss_query: input.rss_query ?? current.rss_query,
    is_active: input.is_active ?? current.is_active,
    months_back: input.months_back ?? current.months_back,
    item_limit: input.item_limit ?? current.item_limit,
    priority: input.priority ?? current.priority,
  });

  const { data, error } = await admin
    .from("gustavo_content_topics")
    .update(parsed)
    .eq("id", id)
    .select(TOPIC_SELECT)
    .maybeSingle();
  if (error) throw new GustavoContentError(error.message, 500);
  if (!data) throw new GustavoContentError("Tema não encontrado.", 404);
  return data as GustavoContentTopic;
}
