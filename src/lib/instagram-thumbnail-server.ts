import { fetchMediaItemById } from "@/lib/instagram-meta";
import {
  lookupPostMediaUrls,
  updateInstagramPostMediaUrls,
} from "@/lib/instagram-posts";
import {
  lookupStoryMediaUrls,
  updateInstagramStoryMediaUrls,
} from "@/lib/instagram-stories";
import { isDeadInstagramStoryMedia } from "@/lib/instagram-thumbnail-client";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const INSTAGRAM_REFERER = "https://www.instagram.com/";

type MediaRecord = {
  source: "post" | "story";
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
};

/**
 * Falhas também vão com cache no navegador: sem isso cada tela recarregada
 * pedia de novo a mesma capa morta (e chamava a Graph API a cada vez).
 */
function thumbnailError(message: string, status: 404 | 502): Response {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": status === 404 ? "private, max-age=86400" : "private, max-age=900",
    },
  });
}

function getMetaToken(): string {
  const raw =
    process.env.TOKEN_META_BP?.trim() ||
    process.env.TOKEN_META_ADS?.trim() ||
    "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function isCdnUrl(url: string): boolean {
  return /cdninstagram\.com|fbcdn\.net/i.test(url);
}

function pickDisplayUrl(record: MediaRecord): string | null {
  const isVideo = record.media_type === "VIDEO";
  if (isVideo) return record.thumbnail_url || record.media_url;
  return record.media_url || record.thumbnail_url;
}

function withAccessToken(url: string, token: string): string {
  if (!token || url.includes("access_token=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(token)}`;
}

async function fetchCdnImage(url: string): Promise<Response | null> {
  if (!isCdnUrl(url)) {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? res : null;
  }

  const token = getMetaToken();
  const candidates = [
    url,
    token ? withAccessToken(url, token) : null,
  ].filter((u): u is string => Boolean(u));

  for (const candidate of candidates) {
    const res = await fetch(candidate, {
      headers: {
        "User-Agent": BROWSER_UA,
        Referer: INSTAGRAM_REFERER,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });
    if (res.ok) return res;
  }

  return null;
}

async function lookupMediaRecord(igMediaId: string): Promise<MediaRecord | null> {
  const post = await lookupPostMediaUrls(igMediaId);
  if (post) {
    return { source: "post", ...post };
  }

  const story = await lookupStoryMediaUrls(igMediaId);
  if (story) {
    return { source: "story", ...story };
  }

  return null;
}

async function refreshMediaFromGraph(
  igMediaId: string,
  source: "post" | "story"
): Promise<MediaRecord | null> {
  const fresh = await fetchMediaItemById(igMediaId);
  if (!fresh) return null;

  const record: MediaRecord = {
    source,
    media_type: fresh.media_type ?? null,
    media_url: fresh.media_url ?? null,
    thumbnail_url: fresh.thumbnail_url ?? null,
  };

  if (source === "post") {
    await updateInstagramPostMediaUrls(igMediaId, {
      media_url: record.media_url,
      thumbnail_url: record.thumbnail_url,
    });
  } else {
    await updateInstagramStoryMediaUrls(igMediaId, {
      media_url: record.media_url,
      thumbnail_url: record.thumbnail_url,
    });
  }

  return record;
}

export async function fetchInstagramThumbnailResponse(
  igMediaId: string
): Promise<Response> {
  let record = await lookupMediaRecord(igMediaId);

  if (!record) {
    const fresh = await fetchMediaItemById(igMediaId);
    if (!fresh) {
      return thumbnailError("Mídia não encontrada.", 404);
    }
    record = {
      source: "post",
      media_type: fresh.media_type ?? null,
      media_url: fresh.media_url ?? null,
      thumbnail_url: fresh.thumbnail_url ?? null,
    };
  }

  // Story expirado não volta pela Graph API: nem tenta o CDN nem a renovação.
  if (record.source === "story" && isDeadInstagramStoryMedia(record)) {
    return thumbnailError("Story expirado no Instagram.", 404);
  }

  const source = record.source;
  let url = pickDisplayUrl(record);
  if (!url) {
    record = await refreshMediaFromGraph(igMediaId, source);
    url = record ? pickDisplayUrl(record) : null;
  }

  if (!url) {
    return thumbnailError("URL da mídia indisponível.", 404);
  }

  let cdnRes = await fetchCdnImage(url);
  if (!cdnRes) {
    const refreshed = await refreshMediaFromGraph(igMediaId, source);
    const freshUrl = refreshed ? pickDisplayUrl(refreshed) : null;
    if (!freshUrl) {
      return thumbnailError("Não foi possível carregar a capa.", 502);
    }
    cdnRes = await fetchCdnImage(freshUrl);
    if (!cdnRes) {
      return thumbnailError("CDN do Instagram recusou o acesso.", 502);
    }
  }

  const contentType = cdnRes.headers.get("content-type") ?? "image/jpeg";
  const body = await cdnRes.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
