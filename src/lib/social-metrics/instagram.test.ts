import { describe, expect, it } from "vitest";
import type { InstagramPost } from "@/lib/instagram-posts";
import {
  computeFormatStats,
  computeInstagramKpis,
  computeViewsByFormat,
  dailySeries,
  followersAt,
  followersByDay,
  insightCoverageStart,
  postFormat,
  sumCovered,
  type InsightDay,
} from "./instagram";
import { buildSummaryFacts, summarizeLinkedin, summarizeSite, type MetricsSummaryData } from "./summary";
import { resolveMetricsPeriod } from "./period";
import { coverSourceUrl } from "@/lib/instagram-covers-source";

function day(date: string, partial: Partial<InsightDay> = {}): InsightDay {
  return {
    date,
    reach: 100,
    views: 300,
    reach_followers: null,
    reach_non_followers: null,
    accounts_engaged: 10,
    total_interactions: 20,
    likes: 10,
    comments: 2,
    saves: 1,
    shares: 1,
    replies: 0,
    follows: null,
    unfollows: null,
    profile_links_taps: 0,
    reposts: 0,
    new_followers: null,
    views_reels: null,
    views_stories: null,
    views_carousel: null,
    views_posts: null,
    ...partial,
  };
}

function post(partial: Partial<InstagramPost> = {}): InstagramPost {
  return {
    id: partial.id ?? "p1",
    ig_media_id: "m1",
    caption: "Post",
    media_type: "IMAGE",
    media_url: null,
    thumbnail_url: null,
    permalink: null,
    published_at: "2026-11-10T15:00:00Z",
    area: null,
    areas: [],
    solicitante_id: null,
    solicitante: null,
    solicitantes: [],
    skip_participants: false,
    tags: [],
    likes: 10,
    comments: 5,
    reach: 100,
    views: 200,
    saves: 5,
    shares: 2,
    total_interactions: 22,
    media_product_type: "FEED",
    follows: 0,
    profile_visits: 0,
    reposts: 0,
    profile_activity: 0,
    link_clicks: 0,
    reels_avg_watch_time: 0,
    reels_total_watch_time: 0,
    synced_at: "",
    created_at: "",
    ...partial,
  };
}

describe("números da conta", () => {
  const days = [
    day("2026-11-01", { views: 0, total_interactions: 0 }),
    day("2026-11-02", { follows: 3, unfollows: 1 }),
    day("2026-11-03", { follows: 0, unfollows: 2 }),
  ];

  it("ignora dias sem dado da Meta e avisa a cobertura", () => {
    expect(insightCoverageStart(days, "follows")).toBe("2026-11-02");
    const follows = sumCovered(days, "follows", "2026-11-01", "2026-11-03");
    expect(follows.value).toBe(3);
    expect(follows.partial).toBe(true);
    expect(sumCovered(days, "follows", "2026-10-01", "2026-10-31").value).toBeNull();
  });

  it("série diária põe null antes da cobertura", () => {
    expect(dailySeries(days, "views", "2026-11-01", "2026-11-03").map((p) => p.value)).toEqual([null, 300, 300]);
  });

  it("KPIs: alcance é média por dia, seguidores é saldo", () => {
    const kpis = computeInstagramKpis(days, [post()], "2026-11-01", "2026-11-30");
    expect(kpis.reachAvg).toBe(100);
    expect(kpis.netFollowers).toBe(0);
    expect(kpis.follows).toBe(3);
    expect(kpis.posts).toBe(1);
    expect(kpis.engagementRate).toBeCloseTo(20);
  });

  it("visualizações por formato", () => {
    const withFormats = [day("2026-11-05", { views_reels: 10, views_stories: 20, views_carousel: 30, views_posts: 40 })];
    expect(computeViewsByFormat(withFormats, "2026-11-01", "2026-11-05")).toMatchObject({ total: 100, reels: 10, missingDays: 4 });
    expect(computeViewsByFormat(days, "2026-11-01", "2026-11-03")).toBeNull();
  });
});

describe("posts", () => {
  it("formato a partir do tipo da Meta", () => {
    expect(postFormat({ media_type: "VIDEO", media_product_type: "REELS" })).toBe("reels");
    expect(postFormat({ media_type: "CAROUSEL_ALBUM", media_product_type: "FEED" })).toBe("carrossel");
    expect(postFormat({ media_type: "IMAGE", media_product_type: "FEED" })).toBe("imagem");
  });

  it("desempenho por formato é média por post", () => {
    const stats = computeFormatStats([post({ id: "a", reach: 100 }), post({ id: "b", reach: 300 }), post({ id: "c", media_type: "VIDEO", media_product_type: "REELS", reach: 1000 })]);
    expect(stats.find((s) => s.format === "imagem")).toMatchObject({ posts: 2, avgReach: 200 });
    expect(stats.find((s) => s.format === "reels")).toMatchObject({ posts: 1, avgReach: 1000 });
    expect(stats.find((s) => s.format === "carrossel")?.posts).toBe(0);
  });

  it("seguidores no fim de cada dia (fuso de São Paulo)", () => {
    const byDay = followersByDay([
      { fetched_at: "2026-11-20T09:00:00Z", followers_count: 10 },
      { fetched_at: "2026-11-20T20:00:00Z", followers_count: 12 },
      { fetched_at: "2026-11-21T02:00:00Z", followers_count: 13 },
    ]);
    expect(byDay.get("2026-11-20")).toBe(13);
    expect(followersAt(byDay, "2026-11-25")).toBe(13);
    expect(followersAt(byDay, "2026-11-01")).toBeNull();
  });
});

describe("resumo", () => {
  it("LinkedIn e site somam o período e avisam quando não há dado", () => {
    expect(summarizeLinkedin([], [], "2026-11-01", "2026-11-30").impressions).toBeNull();
    const li = summarizeLinkedin(
      [{ date: "2026-11-02", impressions: 1000, clicks: 50, reactions: 20, comments: 5, shares: 5 }],
      [{ date: "2026-11-02", newFollowers: 4 }],
      "2026-11-01",
      "2026-11-30"
    );
    expect(li).toMatchObject({ impressions: 1000, clicks: 50, newFollowers: 4 });
    expect(li.ctr).toBeCloseTo(5);
    expect(li.engagementRate).toBeCloseTo(8);
    const site = summarizeSite(
      [{ date: "2026-11-02", sessions: 200, users: 150, conversions: 3, whatsapp: 2 }],
      [{ date: "2026-11-02", value: 20 }],
      "2026-11-01",
      "2026-11-30"
    );
    expect(site).toMatchObject({ sessions: 200, leads: 3, whatsapp: 2, socialSessions: 20 });
    expect(site.socialShare).toBeCloseTo(10);
  });

  it("fatos para a IA citam o canal sem dados", () => {
    const data: MetricsSummaryData = {
      channels: { instagram: false, linkedin: true, site: false },
      instagram: null,
      linkedin: {
        days: [],
        followers: [],
        posts: [],
        freshness: { source: "linkedin", label: "LinkedIn", lastSuccessAt: null, lastAttemptAt: null, lastError: null, dataUntil: "2026-09-29", staleAfterHours: 840, howItArrives: "" },
      },
      site: null,
      notes: [],
    };
    const facts = buildSummaryFacts(data, resolveMetricsPeriod({ preset: "28d", compare: "anterior" }, new Date("2026-11-23T13:00:00Z")));
    expect(facts).toContain("Sem dados importados para o período (dados até 2026-09-29)");
  });
});

describe("capa", () => {
  it("vídeo usa o thumbnail; imagem usa a mídia; link vencido ou .mp4 não serve", () => {
    const future = (Math.floor(Date.now() / 1000) + 86_400).toString(16);
    const past = (Math.floor(Date.now() / 1000) - 86_400).toString(16);
    const cdn = (name: string, oe: string) => `https://scontent.cdninstagram.com/${name}?oe=${oe}`;
    expect(coverSourceUrl({ mediaType: "VIDEO", thumbnailUrl: cdn("t.jpg", future), mediaUrl: cdn("v.mp4", future) })).toContain("t.jpg");
    expect(coverSourceUrl({ mediaType: "IMAGE", thumbnailUrl: null, mediaUrl: cdn("i.jpg", future) })).toContain("i.jpg");
    expect(coverSourceUrl({ mediaType: "IMAGE", thumbnailUrl: null, mediaUrl: cdn("i.jpg", past) })).toBeNull();
    expect(coverSourceUrl({ mediaType: "VIDEO", thumbnailUrl: null, mediaUrl: cdn("v.mp4", future) })).toBeNull();
  });
});
