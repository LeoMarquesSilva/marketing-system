import { fetchMediaItemById } from "@/lib/instagram-meta";
import {
  lookupPostMediaUrls,
  updateInstagramPostMediaUrls,
} from "@/lib/instagram-posts";
import {
  lookupStoryMediaUrls,
  updateInstagramStoryMediaUrls,
} from "@/lib/instagram-stories";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const INSTAGRAM_REFERER = "https://www.instagram.com/";

type MediaRecord = {
  source: "post" | "story";
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
};

export function hasInstagramThumbnail(
  post: { thumbnail_url?: string | null; media_url?: string | null }
): boolean {
  return Boolean(post.thumbnail_url || post.media_url);
}

/** URL do proxy — evita 403 do CDN do Instagram no navegador. */
export function getInstagramThumbnailProxyUrl(igMediaId: string): string {
  return `/api/instagram/thumbnail/${encodeURIComponent(igMediaId)}`;
}

function pickDisplayUrl(record: MediaRecord): string | null {
  const isVideo = record.media_type === "VIDEO";
  if (isVideo) return record.thumbnail_url || record.media_url;
  return record.media_url || record.thumbnail_url;
}

async function fetchCdnImage(url: string): Promise<Response | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: INSTAGRAM_REFERER,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res;
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
      return new Response("Mídia não encontrada.", { status: 404 });
    }
    record = {
      source: "post",
      media_type: fresh.media_type ?? null,
      media_url: fresh.media_url ?? null,
      thumbnail_url: fresh.thumbnail_url ?? null,
    };
  }

  const source = record.source;
  let url = pickDisplayUrl(record);
  if (!url) {
    record = await refreshMediaFromGraph(igMediaId, source);
    url = record ? pickDisplayUrl(record) : null;
  }

  if (!url) {
    return new Response("URL da mídia indisponível.", { status: 404 });
  }

  let cdnRes = await fetchCdnImage(url);
  if (!cdnRes) {
    const refreshed = await refreshMediaFromGraph(igMediaId, source);
    const freshUrl = refreshed ? pickDisplayUrl(refreshed) : null;
    if (!freshUrl) {
      return new Response("Não foi possível carregar a capa.", { status: 502 });
    }
    cdnRes = await fetchCdnImage(freshUrl);
    if (!cdnRes) {
      return new Response("CDN do Instagram recusou o acesso.", { status: 502 });
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
