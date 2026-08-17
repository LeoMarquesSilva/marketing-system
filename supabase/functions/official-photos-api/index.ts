import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createOfficialPhotosHandler,
  type OfficialPhotoResult,
} from "../_shared/official-photos-domain.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada.");
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface PhotoRow {
  user_id: string;
  name: string;
  email: string | null;
  photo_url: string | null;
  source: "selected" | "legacy_avatar" | "none";
  version: string;
  updated_at: string;
}

function toResult(row: PhotoRow, externalUserId: string | null): OfficialPhotoResult {
  return {
    externalUserId,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    photoUrl: row.photo_url,
    source: row.source,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

const handler = createOfficialPhotosHandler({
  async findConsumersByPrefix(prefix) {
    const { data, error } = await db
      .from("official_photo_api_consumers")
      .select("id, slug, key_prefix, key_hash, allowed_scopes")
      .eq("key_prefix", prefix)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((row) => row.key_prefix && row.key_hash)
      .map((row) => ({
        id: row.id as string,
        slug: row.slug as string,
        keyPrefix: row.key_prefix as string,
        keyHash: row.key_hash as string,
        allowedScopes: (row.allowed_scopes ?? []) as string[],
      }));
  },

  async consumeQuota(consumerId) {
    const { data, error } = await db.rpc("consume_official_photo_api_quota", {
      p_consumer_id: consumerId,
    });
    if (error) throw new Error(error.message);
    return data === true;
  },

  async lookupByExternalIds(consumerId, externalUserIds) {
    const { data: links, error: linksError } = await db
      .from("official_photo_system_links")
      .select("external_user_id, user_id")
      .eq("consumer_id", consumerId)
      .in("external_user_id", externalUserIds);
    if (linksError) throw new Error(linksError.message);
    if (!links || links.length === 0) return [];

    const userIds = [...new Set(links.map((link) => link.user_id as string))];
    const { data: photos, error: photosError } = await db
      .from("official_system_photos")
      .select("user_id, name, email, photo_url, source, version, updated_at")
      .in("user_id", userIds);
    if (photosError) throw new Error(photosError.message);

    const photosByUserId = new Map(
      ((photos ?? []) as PhotoRow[]).map((photo) => [photo.user_id, photo])
    );
    const externalIdByUserId = new Map(
      links.map((link) => [link.user_id as string, link.external_user_id as string])
    );
    return userIds.flatMap((userId) => {
      const photo = photosByUserId.get(userId);
      if (!photo) return [];
      return [toResult(photo, externalIdByUserId.get(userId) ?? null)];
    });
  },

  async lookupByEmail(normalizedEmail) {
    const { data, error } = await db
      .from("official_system_photos")
      .select("user_id, name, email, photo_url, source, version, updated_at")
      .eq("normalized_email", normalizedEmail)
      .limit(2);
    if (error) throw new Error(error.message);
    return ((data ?? []) as PhotoRow[]).map((row) => toResult(row, null));
  },

  async audit(input) {
    const { error } = await db.from("official_photo_api_requests").insert({
      consumer_id: input.consumerId,
      route: input.route,
      method: input.method,
      status_code: input.statusCode,
      latency_ms: input.latencyMs,
      lookup_count: input.lookupCount,
    });
    if (error) {
      console.error("[official-photos-api] audit:", error.message);
    }
  },
});

Deno.serve(handler);
