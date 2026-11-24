import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { canAccessPath } from "@/lib/access-control";
import type { MetricsSummaryData } from "@/lib/social-metrics/summary";

export interface MetricsAccess {
  userId: string;
  channels: MetricsSummaryData["channels"];
  /** Vê os três canais: pode gerar e comentar a leitura do período. */
  canWriteReading: boolean;
}

/** Canais de Métricas que a pessoa logada pode ver (null = sem login ou inativa). */
export async function currentMetricsAccess(): Promise<MetricsAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  const { data: profile } = await createAdminClient(url, key)
    .from("users")
    .select("id, role, permissions, department, ferias_view_enabled, vistagem_papel, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!profile || profile.is_active === false) return null;

  const channels = {
    instagram: canAccessPath(profile, "/instagram-insights"),
    linkedin: canAccessPath(profile, "/linkedin-insights"),
    site: canAccessPath(profile, "/ga4-insights"),
  };
  return {
    userId: profile.id as string,
    channels,
    canWriteReading: channels.instagram && channels.linkedin && channels.site,
  };
}
