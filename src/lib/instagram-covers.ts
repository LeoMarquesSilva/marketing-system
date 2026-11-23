import "server-only";

/**
 * Capas do Instagram no Storage do Supabase.
 *
 * O link do CDN do Instagram vence em poucos dias (e o do story morre com ele em
 * 24 h). Antes, cada miniatura passava por /api/instagram/thumbnail a cada
 * visita, o que pesava no CPU da Vercel. Agora a coleta copia a capa UMA vez
 * (reduzida para 720 px em WebP) e a tela usa o link público do bucket.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { INSTAGRAM_COVERS_BUCKET } from "@/lib/instagram-thumbnail-client";
import { coverSourceUrl } from "@/lib/instagram-covers-source";

const COVER_WIDTH = 720;
const COVER_CONCURRENCY = 4;
const DEFAULT_LIMIT = 120;

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key);
}

interface CoverCandidate {
  rowId: string;
  mediaId: string;
  mediaType: string | null;
  mediaProductType?: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
}

async function downloadAndUpload(path: string, sourceUrl: string): Promise<void> {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`CDN respondeu ${response.status}`);
  const input = Buffer.from(await response.arrayBuffer());
  const output = await sharp(input)
    .rotate()
    .resize({ width: COVER_WIDTH, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const { error } = await adminDb()
    .storage.from(INSTAGRAM_COVERS_BUCKET)
    .upload(path, output, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
}

async function saveCovers(
  table: "instagram_posts" | "instagram_stories",
  folder: "posts" | "stories",
  candidates: CoverCandidate[]
): Promise<{ saved: number; failed: number }> {
  const db = adminDb();
  let saved = 0;
  let failed = 0;
  let index = 0;

  async function worker() {
    while (index < candidates.length) {
      const candidate = candidates[index++];
      const source = coverSourceUrl(candidate);
      if (!source) {
        failed += 1;
        continue;
      }
      const path = `${folder}/${candidate.mediaId}.webp`;
      try {
        await downloadAndUpload(path, source);
        const { error } = await db.from(table).update({ cover_path: path }).eq("id", candidate.rowId);
        if (error) throw new Error(error.message);
        saved += 1;
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(COVER_CONCURRENCY, candidates.length) }, () => worker()));
  return { saved, failed };
}

/** Copia a capa dos posts que ainda não têm (os mais recentes primeiro). */
export async function saveMissingPostCovers(limit = DEFAULT_LIMIT): Promise<{ saved: number; failed: number }> {
  const { data, error } = await adminDb()
    .from("instagram_posts")
    .select("id, ig_media_id, media_type, media_product_type, thumbnail_url, media_url")
    .is("cover_path", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return saveCovers(
    "instagram_posts",
    "posts",
    (data ?? []).map((row) => ({
      rowId: row.id as string,
      mediaId: row.ig_media_id as string,
      mediaType: (row.media_type as string | null) ?? null,
      mediaProductType: (row.media_product_type as string | null) ?? null,
      thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
      mediaUrl: (row.media_url as string | null) ?? null,
    }))
  );
}

/** Copia a capa dos stories ainda com link válido (story vencido não tem mais de onde baixar). */
export async function saveMissingStoryCovers(limit = DEFAULT_LIMIT): Promise<{ saved: number; failed: number }> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await adminDb()
    .from("instagram_stories")
    .select("id, ig_story_id, media_type, thumbnail_url, media_url")
    .is("cover_path", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return saveCovers(
    "instagram_stories",
    "stories",
    (data ?? []).map((row) => ({
      rowId: row.id as string,
      mediaId: row.ig_story_id as string,
      mediaType: (row.media_type as string | null) ?? null,
      thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
      mediaUrl: (row.media_url as string | null) ?? null,
    }))
  );
}
