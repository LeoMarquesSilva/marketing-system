import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface InfraProjectProfile {
  project_ref: string;
  display_name: string | null;
  logo_url: string | null;
  category: string | null;
  description: string | null;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
}

export interface InfraProjectProfileInput {
  display_name?: string | null;
  logo_url?: string | null;
  category?: string | null;
  description?: string | null;
  sort_order?: number;
}

function getAdminClient() {
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function loadInfraProjectProfiles(
  refs?: string[]
): Promise<Map<string, InfraProjectProfile>> {
  const supabase = getAdminClient();
  let query = supabase.from("infra_project_profiles").select("*");
  if (refs?.length) query = query.in("project_ref", refs);

  const { data, error } = await query;
  if (error || !data) return new Map();

  return new Map(data.map((row) => [row.project_ref as string, row as InfraProjectProfile]));
}

export async function upsertInfraProjectProfile(
  projectRef: string,
  input: InfraProjectProfileInput,
  updatedBy?: string
): Promise<InfraProjectProfile> {
  const supabase = getAdminClient();
  const payload = {
    project_ref: projectRef,
    display_name: input.display_name?.trim() || null,
    logo_url: input.logo_url?.trim() || null,
    category: input.category?.trim() || null,
    description: input.description?.trim() || null,
    sort_order: input.sort_order ?? 0,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy ?? null,
  };

  const { data, error } = await supabase
    .from("infra_project_profiles")
    .upsert(payload, { onConflict: "project_ref" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as InfraProjectProfile;
}

export function resolveProjectDisplayName(
  supabaseName: string,
  profile: InfraProjectProfile | undefined
): string {
  return profile?.display_name?.trim() || supabaseName;
}

export const PROJECT_LOGOS_BUCKET = "MARKETING-SYSTEM-PROJETOS";

export function publicStorageUrl(path: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PROJECT_LOGOS_BUCKET}/${path}`;
}
