/**
 * Persistência best-effort de eventos de perfil (somente servidor).
 *
 * Não importar de Client Components — use `metrics.ts` para beacon/sanitização.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createProfileAdminClient } from "@/lib/profiles/admin";
import type { RecordProfileEventInput } from "@/lib/profiles/metrics";

function logWriteFailure(profileId: string): void {
  console.error("PROFILE_EVENT_WRITE_FAILED", { profileId });
}

/**
 * Grava evento com melhor esforço: tenta a RPC com teto por minuto;
 * se a RPC falhar (ausente ou erro), tenta insert direto. Nunca lança.
 */
export async function recordProfileEvent(
  input: RecordProfileEventInput,
  options?: { client?: SupabaseClient }
): Promise<void> {
  try {
    const db = options?.client ?? createProfileAdminClient();
    const cardId = input.cardId ?? null;

    const { error: rpcError } = await db.rpc("record_professional_profile_event", {
      p_profile_id: input.profileId,
      p_event_type: input.eventType,
      p_source: input.source,
      p_locale: input.locale,
      p_card_id: cardId,
    });

    if (!rpcError) return;

    const { error: insertError } = await db.from("professional_profile_events").insert({
      profile_id: input.profileId,
      card_id: cardId,
      event_type: input.eventType,
      source: input.source,
      locale: input.locale,
    });

    if (insertError) {
      logWriteFailure(input.profileId);
    }
  } catch {
    logWriteFailure(input.profileId);
  }
}

/** Resolve o id de um perfil publicado pelo slug; null se rascunho/ausente. */
export async function getPublishedProfileIdBySlug(
  slug: string,
  options?: { client?: SupabaseClient }
): Promise<string | null> {
  try {
    const db = options?.client ?? createProfileAdminClient();
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;

    const { data, error } = await db
      .from("professional_profiles")
      .select("id, status")
      .eq("slug", normalized)
      .maybeSingle();

    if (error || !data) return null;
    if ((data as { status?: string }).status !== "published") return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}
