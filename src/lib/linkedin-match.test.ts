import { describe, expect, it } from "vitest";
import type { InstagramPost } from "@/lib/instagram-posts";
import { captionSimilarity, matchLinkedinPostToInstagram } from "@/lib/linkedin-match";
import type { ParsedLinkedinPost } from "@/lib/linkedin-types";

function linkedinPost(overrides: Partial<ParsedLinkedinPost> = {}): ParsedLinkedinPost {
  return {
    linkedin_urn: "123",
    caption: "Planejamento societário ajuda a proteger a empresa. #societario",
    permalink: "https://linkedin.com/123",
    publication_type: "Orgânico",
    campaign_name: null,
    published_by: "Leonardo",
    published_at: "2026-07-10T00:00:00.000Z",
    campaign_start_at: null,
    campaign_end_at: null,
    audience: "Todos os seguidores",
    impressions: 100,
    views: 0,
    offsite_views: 0,
    clicks: 10,
    ctr: 0.1,
    likes: 5,
    comments: 1,
    shares: 1,
    followers: 0,
    engagement_rate: 0.17,
    content_type: null,
    byline: null,
    ...overrides,
  };
}

function instagramPost(overrides: Partial<InstagramPost> = {}): InstagramPost {
  return {
    id: "6da03e8e-efaa-4bb1-a47a-384d3059f781",
    ig_media_id: "ig-1",
    caption: "Planejamento societário ajuda a proteger a empresa. #societario",
    media_type: "IMAGE",
    media_url: null,
    thumbnail_url: null,
    permalink: null,
    published_at: "2026-07-10T13:00:00.000Z",
    area: null,
    areas: [],
    solicitante_id: null,
    solicitante: null,
    solicitantes: [],
    skip_participants: false,
    tags: [],
    likes: 0,
    comments: 0,
    reach: 0,
    views: 0,
    saves: 0,
    shares: 0,
    total_interactions: 0,
    media_product_type: null,
    follows: 0,
    profile_visits: 0,
    reposts: 0,
    profile_activity: 0,
    link_clicks: 0,
    reels_avg_watch_time: 0,
    reels_total_watch_time: 0,
    synced_at: "2026-07-10T13:00:00.000Z",
    created_at: "2026-07-10T13:00:00.000Z",
    ...overrides,
  };
}

describe("LinkedIn to Instagram matching", () => {
  it("matches equal captions on the same date", () => {
    const result = matchLinkedinPostToInstagram(linkedinPost(), [instagramPost()]);
    expect(result).toMatchObject({
      instagramPostId: "6da03e8e-efaa-4bb1-a47a-384d3059f781",
      strategy: "exact_caption_date",
    });
    expect(result?.confidence).toBeGreaterThanOrEqual(0.98);
  });

  it("accepts small platform-specific caption differences", () => {
    const similarity = captionSimilarity(
      "Contrato social protege os sócios e a empresa. Fale com nossa equipe.",
      "Contrato social protege os sócios e a empresa. Acesse o link da bio."
    );
    expect(similarity).toBeGreaterThan(0.5);
  });

  it("does not link unrelated posts just because the date is equal", () => {
    const result = matchLinkedinPostToInstagram(linkedinPost(), [
      instagramPost({ caption: "Evento interno e fotos da confraternização." }),
    ]);
    expect(result).toBeNull();
  });
});
