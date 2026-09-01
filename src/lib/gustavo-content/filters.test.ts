import { describe, expect, it } from "vitest";
import { filterRadarItems, overviewMetrics } from "@/lib/gustavo-content/filters";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";

function item(partial: Partial<GustavoContentItem>): GustavoContentItem {
  return {
    id: "1",
    source: "rss",
    topic_id: "t1",
    title: "GPA anuncia reestruturação",
    link: null,
    content_snippet: null,
    published_at: null,
    image_url: null,
    source_context: null,
    editorial_score: 80,
    score_breakdown: null,
    score_reason: null,
    business_problem: "A dívida cresceu mais rápido que o caixa.",
    angles: null,
    selected_angle: null,
    thesis_id: "tese-1",
    thesis_snapshot: null,
    opinion_status: "validated",
    gustavo_questions: null,
    gustavo_answers: null,
    recommended_channels: {
      linkedin: { recommended: true, reason: "técnica" },
      instagramReel: { recommended: false, reason: "muito técnica" },
    },
    linkedin_post: null,
    original_linkedin_post: null,
    reel_script: null,
    original_reel_script: null,
    alternative_hooks: null,
    compliance_flags: null,
    factual_flags: null,
    status: "sugestao",
    rejection_reason: null,
    has_alterations: false,
    created_by: null,
    created_by_name: null,
    edited_by: null,
    edited_by_name: null,
    edited_at: null,
    submitted_to_gustavo_at: null,
    approved_by: null,
    approved_at: null,
    approval_kind: null,
    marketing_request_linkedin_id: null,
    marketing_request_reel_id: null,
    linkedin_published_url: null,
    instagram_published_url: null,
    linkedin_published_at: null,
    instagram_published_at: null,
    performance: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("filterRadarItems", () => {
  it("filtra por tese e canal", () => {
    const items = [
      item({ id: "1" }),
      item({
        id: "2",
        thesis_id: null,
        recommended_channels: {
          linkedin: { recommended: true, reason: "" },
          instagramReel: { recommended: true, reason: "" },
        },
      }),
    ];
    expect(filterRadarItems(items, { thesis: "without" }).map((row) => row.id)).toEqual(["2"]);
    expect(filterRadarItems(items, { channel: "reel" }).map((row) => row.id)).toEqual(["2"]);
  });
});

describe("overviewMetrics", () => {
  it("conta sugestões e espera do Gustavo", () => {
    const metrics = overviewMetrics([
      item({ status: "sugestao" }),
      item({ id: "2", status: "aguardando_opiniao" }),
      item({ id: "3", status: "aprovado" }),
    ]);
    expect(metrics.suggestions).toBe(1);
    expect(metrics.waitingGustavo).toBe(1);
    expect(metrics.approved).toBe(1);
  });
});
