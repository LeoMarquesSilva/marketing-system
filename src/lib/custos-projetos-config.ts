/**
 * Configuração dos projetos Supabase rastreados na página de custos.
 * Sobrescreva com SUPABASE_BILLING_TRACKED_ORGS (JSON) no .env.
 */

export const MARX_PROJETOS_ORG_SLUG = "repxesskjupelfxenmrm";

export interface TrackedSupabaseProject {
  ref: string;
  name: string;
  /** Ex.: "Marketing", "CRM", "Inovação" */
  category?: string;
}

export interface TrackedSupabaseOrg {
  slug: string;
  label: string;
  /** Se vazio, lista todos os projetos da organização. */
  projects?: TrackedSupabaseProject[];
}

const DEFAULT_TRACKED_ORGS: TrackedSupabaseOrg[] = [
  { slug: MARX_PROJETOS_ORG_SLUG, label: "Marx Projetos" },
];

export function getTrackedSupabaseOrgs(): TrackedSupabaseOrg[] {
  const raw = process.env.SUPABASE_BILLING_TRACKED_ORGS?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as TrackedSupabaseOrg[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // usa default
    }
  }
  return DEFAULT_TRACKED_ORGS;
}
