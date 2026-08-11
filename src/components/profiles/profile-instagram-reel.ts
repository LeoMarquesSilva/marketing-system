const INSTAGRAM_REEL_PATH = /^\/(?:reel|reels)\/([A-Za-z0-9_-]+)\/?$/;
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

export function buildInstagramReelEmbedUrl(
  linkUrl: string | null | undefined
): string | null {
  if (!linkUrl) return null;

  try {
    const url = new URL(linkUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;

    const shortcode = url.pathname.match(INSTAGRAM_REEL_PATH)?.[1];
    if (!shortcode) return null;

    return `https://www.instagram.com/reel/${shortcode}/embed/`;
  } catch {
    return null;
  }
}
