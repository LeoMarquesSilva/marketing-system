import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface ContentTopic {
  id: string;
  name: string;
  rss_query: string;
  legal_area: string;
  is_active: boolean;
  months_back: number;
  item_limit: number;
  created_at: string;
}

export async function fetchContentTopics(includeInactive = false): Promise<ContentTopic[]> {
  const supabase = getAdminClient();
  let query = supabase
    .from("content_topics")
    .select("id, name, rss_query, legal_area, is_active, months_back, item_limit, created_at")
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentTopic[];
}

export async function createContentTopic(input: {
  name: string;
  rss_query: string;
  legal_area: string;
  is_active?: boolean;
  months_back?: number;
  item_limit?: number;
}): Promise<ContentTopic> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("content_topics")
    .insert({
      name: input.name,
      rss_query: input.rss_query,
      legal_area: input.legal_area,
      is_active: input.is_active ?? true,
      months_back: input.months_back ?? 4,
      item_limit: input.item_limit ?? 20,
    })
    .select("id, name, rss_query, legal_area, is_active, months_back, item_limit, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ContentTopic;
}

export async function updateContentTopic(
  id: string,
  input: Partial<{ name: string; rss_query: string; legal_area: string; is_active: boolean; months_back: number; item_limit: number }>
): Promise<ContentTopic> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("content_topics")
    .update(input)
    .eq("id", id)
    .select("id, name, rss_query, legal_area, is_active, months_back, item_limit, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ContentTopic;
}

export async function deleteContentTopic(id: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("content_topics").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
