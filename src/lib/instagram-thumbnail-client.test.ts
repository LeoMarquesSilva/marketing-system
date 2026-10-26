import { describe, expect, it } from "vitest";
import {
  instagramCdnUrlExpiresAt,
  isDeadInstagramStoryMedia,
  isExpiredInstagramCdnUrl,
  sanitizeInstagramStoryForClient,
} from "./instagram-thumbnail-client";

// oe=6A000000 → 0x6A000000 s, maio de 2026
const EXPIRED =
  "https://scontent.cdninstagram.com/v/t51/123_n.jpg?stp=dst-jpg&_nc_ht=x&oh=00_abc&oe=6A000000";
const NOW = Date.parse("2026-10-26T12:00:00Z");
const VALID = EXPIRED.replace("oe=6A000000", `oe=${Math.floor((NOW + 86_400_000) / 1000).toString(16).toUpperCase()}`);

describe("instagramCdnUrlExpiresAt", () => {
  it("lê o vencimento em hex do parâmetro oe", () => {
    expect(instagramCdnUrlExpiresAt(EXPIRED)).toBe(0x6a000000 * 1000);
  });

  it("ignora URL sem oe ou fora do CDN", () => {
    expect(instagramCdnUrlExpiresAt("https://scontent.cdninstagram.com/v/a.jpg")).toBeNull();
    expect(instagramCdnUrlExpiresAt("https://exemplo.com/a.jpg?oe=6A000000")).toBeNull();
    expect(instagramCdnUrlExpiresAt(null)).toBeNull();
  });
});

describe("isExpiredInstagramCdnUrl", () => {
  it("compara com o horário atual", () => {
    expect(isExpiredInstagramCdnUrl(EXPIRED, NOW)).toBe(true);
    expect(isExpiredInstagramCdnUrl(VALID, NOW)).toBe(false);
  });
});

describe("isDeadInstagramStoryMedia", () => {
  it("só considera morto quando todos os links venceram", () => {
    expect(isDeadInstagramStoryMedia({ media_url: EXPIRED, thumbnail_url: EXPIRED }, NOW)).toBe(true);
    expect(isDeadInstagramStoryMedia({ media_url: EXPIRED, thumbnail_url: VALID }, NOW)).toBe(false);
    expect(isDeadInstagramStoryMedia({ media_url: null, thumbnail_url: null }, NOW)).toBe(false);
  });
});

describe("sanitizeInstagramStoryForClient", () => {
  it("não gera link de proxy para story com capa vencida", () => {
    const story = sanitizeInstagramStoryForClient({
      ig_story_id: "179",
      media_url: EXPIRED,
      thumbnail_url: null,
    });
    expect(story.media_url).toBeNull();
    expect(story.thumbnail_url).toBeNull();
  });

  it("mantém o proxy para story ainda no ar", () => {
    const future = EXPIRED.replace(
      "oe=6A000000",
      `oe=${Math.floor((Date.now() + 86_400_000) / 1000).toString(16)}`
    );
    const story = sanitizeInstagramStoryForClient({ ig_story_id: "179", media_url: future });
    expect(story.media_url).toBe("/api/instagram/thumbnail/179");
  });
});
