import { supabase } from "@/utils/supabase/client";

export interface Area {
  id: string;
  name: string;
}

export async function fetchAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from("areas")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Erro ao buscar áreas:", error);
    return [];
  }
  return (data ?? []) as Area[];
}

export async function createArea(name: string): Promise<{ data: Area | null; error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: "Nome da área é obrigatório" };

  const { data, error } = await supabase
    .from("areas")
    .insert({ name: trimmed })
    .select("id, name")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Area, error: null };
}
