/** Helpers seguros para client — nunca importar lógica server-side aqui. */

export function isInstagramCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /cdninstagram\.com|fbcdn\.net/i.test(url);
}

/** Validade do link do CDN: o parâmetro `oe` traz o vencimento em segundos (hex). */
export function instagramCdnUrlExpiresAt(url: string | null | undefined): number | null {
  if (!url || !isInstagramCdnUrl(url)) return null;
  const match = /[?&]oe=([0-9a-f]+)/i.exec(url);
  if (!match) return null;
  const seconds = parseInt(match[1], 16);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

export function isExpiredInstagramCdnUrl(
  url: string | null | undefined,
  now = Date.now()
): boolean {
  const expiresAt = instagramCdnUrlExpiresAt(url);
  return expiresAt !== null && expiresAt <= now;
}

/**
 * Story com todos os links do CDN vencidos: o Instagram apaga o story depois
 * de 24h e a Graph API não devolve link novo, então não há capa a buscar.
 */
export function isDeadInstagramStoryMedia(
  story: { thumbnail_url?: string | null; media_url?: string | null },
  now = Date.now()
): boolean {
  const urls = [story.thumbnail_url, story.media_url].filter((u): u is string => Boolean(u));
  return urls.length > 0 && urls.every((u) => isExpiredInstagramCdnUrl(u, now));
}

export function hasInstagramThumbnail(post: {
  thumbnail_url?: string | null;
  media_url?: string | null;
}): boolean {
  const thumb = post.thumbnail_url;
  const media = post.media_url;
  if (!thumb && !media) return false;
  if (thumb && !isInstagramCdnUrl(thumb)) return true;
  if (media && !isInstagramCdnUrl(media)) return true;
  return isInstagramCdnUrl(thumb) || isInstagramCdnUrl(media);
}

/** URL do proxy — evita 403 do CDN do Instagram no navegador. */
export function getInstagramThumbnailProxyUrl(igMediaId: string): string {
  return `/api/instagram/thumbnail/${encodeURIComponent(igMediaId)}`;
}

export function resolveInstagramThumbnailSrc(
  igMediaId: string,
  post?: { thumbnail_url?: string | null; media_url?: string | null }
): string | null {
  if (post && !hasInstagramThumbnail(post)) return null;
  if (!igMediaId) return null;
  if (post?.thumbnail_url && !isInstagramCdnUrl(post.thumbnail_url)) {
    return post.thumbnail_url;
  }
  if (post?.media_url && !isInstagramCdnUrl(post.media_url)) {
    return post.media_url;
  }
  return getInstagramThumbnailProxyUrl(igMediaId);
}

/** Substitui URLs do CDN por proxy antes de enviar dados ao browser. */
export function sanitizeInstagramPostForClient<
  T extends {
    ig_media_id: string;
    thumbnail_url?: string | null;
    media_url?: string | null;
  },
>(post: T): T {
  if (!hasInstagramThumbnail(post)) return post;
  const proxy = getInstagramThumbnailProxyUrl(post.ig_media_id);
  return { ...post, thumbnail_url: proxy, media_url: proxy };
}

export function sanitizeInstagramPostsForClient<
  T extends {
    ig_media_id: string;
    thumbnail_url?: string | null;
    media_url?: string | null;
  },
>(posts: T[]): T[] {
  return posts.map(sanitizeInstagramPostForClient);
}

export function sanitizeInstagramStoryForClient<
  T extends {
    ig_story_id?: string;
    id?: string;
    thumbnail_url?: string | null;
    media_url?: string | null;
  },
>(story: T): T {
  const igMediaId = story.ig_story_id ?? story.id;
  // Sem link de proxy para capa morta: cada um virava uma função com 502.
  if (isDeadInstagramStoryMedia(story)) {
    return { ...story, thumbnail_url: null, media_url: null };
  }
  if (!igMediaId || !hasInstagramThumbnail(story)) return story;
  const proxy = getInstagramThumbnailProxyUrl(igMediaId);
  return { ...story, thumbnail_url: proxy, media_url: proxy };
}

export function sanitizeInstagramStoriesForClient<
  T extends {
    ig_story_id?: string;
    id?: string;
    thumbnail_url?: string | null;
    media_url?: string | null;
  },
>(stories: T[]): T[] {
  return stories.map(sanitizeInstagramStoryForClient);
}
