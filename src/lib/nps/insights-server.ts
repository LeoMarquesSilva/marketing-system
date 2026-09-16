/** Persistência e carga dos insights de texto do NPS. Falha isolada — não quebra o NPS. */

import { getAdminClient } from "@/lib/email-marketing-server";
import { classifyNpsOpenTexts, type ClassifiedNpsField } from "@/lib/nps/insights-ai";
import {
  aggregateNpsCampaignInsights,
  emptyNpsCampaignInsights,
  expectedInsightFieldCount,
  isNpsInsightThemeId,
  NPS_INSIGHT_TAXONOMY_VERSION,
  type NpsCampaignInsights,
  type NpsInsightField,
  type NpsInsightFieldRow,
  type NpsInsightPolarity,
  type NpsInsightThemeHit,
} from "@/lib/nps/insights";
import type { NpsResponseRow } from "@/lib/nps/types";

const BACKFILL_BATCH = 8;

type InsightDbRow = {
  response_id: string;
  field: string;
  is_noise: boolean;
  themes: unknown;
  actionable: boolean;
  taxonomy_version?: number | null;
};

function isCurrentTaxonomy(version: unknown): boolean {
  return Number(version) >= NPS_INSIGHT_TAXONOMY_VERSION;
}

function parseThemes(raw: unknown): NpsInsightThemeHit[] {
  if (!Array.isArray(raw)) return [];
  const hits: NpsInsightThemeHit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : "";
    const polarity = rec.polarity;
    const quote = typeof rec.quote === "string" ? rec.quote : "";
    if (!isNpsInsightThemeId(id)) continue;
    if (polarity !== "strength" && polarity !== "pain" && polarity !== "neutral") continue;
    hits.push({ id, polarity: polarity as NpsInsightPolarity, quote });
  }
  return hits;
}

function toInsert(row: ClassifiedNpsField, campaignId: string) {
  return {
    response_id: row.responseId,
    campaign_id: campaignId,
    client_group_id: row.clientGroupId,
    field: row.field,
    is_noise: row.isNoise,
    themes: row.themes,
    actionable: row.actionable,
    suggested_action: row.suggestedAction,
    mentions_partner: row.mentionsPartner,
    source: row.source,
    taxonomy_version: NPS_INSIGHT_TAXONOMY_VERSION,
    classified_at: new Date().toISOString(),
  };
}

export async function classifyNpsResponseInsights(responseId: string): Promise<void> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("nps_responses")
      .select(
        "id, campaign_id, client_group_id, respondent_name, score_recommend, reason, improvement"
      )
      .eq("id", responseId)
      .maybeSingle();
    if (error || !data) return;

    const reason = (data.reason as string | null) ?? null;
    const improvement = (data.improvement as string | null) ?? null;
    if (!reason && !improvement) return;

    const { data: existing } = await admin
      .from("nps_response_insights")
      .select("field, taxonomy_version")
      .eq("response_id", responseId);
    const have = new Set(
      (existing ?? [])
        .filter((r) => isCurrentTaxonomy(r.taxonomy_version))
        .map((r) => r.field as string)
    );
    const needReason = Boolean(reason) && !have.has("reason");
    const needImprovement = Boolean(improvement) && !have.has("improvement");
    if (!needReason && !needImprovement) return;

    const classified = await classifyNpsOpenTexts({
      responseId,
      clientGroupId: data.client_group_id as string,
      respondentName: (data.respondent_name as string) ?? "",
      groupName: "",
      scoreRecommend: Number(data.score_recommend),
      reason: needReason ? reason : null,
      improvement: needImprovement ? improvement : null,
    });
    if (classified.length === 0) return;

    const { error: upsertError } = await admin.from("nps_response_insights").upsert(
      classified.map((row) => toInsert(row, data.campaign_id as string)),
      { onConflict: "response_id,field" }
    );
    if (upsertError) {
      console.error("[nps-insights] upsert falhou", upsertError.message);
    }
  } catch (err) {
    console.error("[nps-insights] classifyNpsResponseInsights", err);
  }
}

function isMissingInsightsTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  if (code === "42P01" || code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("nps_response_insights") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  );
}

export async function loadNpsCampaignInsights(options: {
  responses: Array<NpsResponseRow & { groupName: string }>;
}): Promise<NpsCampaignInsights> {
  const { responses } = options;
  if (responses.length === 0) return emptyNpsCampaignInsights();

  const expectedById = new Map<string, number>();
  let expected = 0;
  for (const response of responses) {
    const count = expectedInsightFieldCount(response.reason, response.improvement);
    expectedById.set(response.id, count);
    expected += count;
  }
  if (expected === 0) return emptyNpsCampaignInsights();

  const blocked = (error: string | null): NpsCampaignInsights => ({
    ...emptyNpsCampaignInsights(),
    pendingCount: expected,
    expectedCount: expected,
    unavailable: true,
    error,
  });

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("nps_response_insights")
      .select("response_id, field, is_noise, themes, actionable, taxonomy_version")
      .in(
        "response_id",
        responses.map((r) => r.id)
      );
    if (error) {
      console.error("[nps-insights] load", error.message);
      return blocked(error.message);
    }

    const byId = new Map(responses.map((r) => [r.id, r]));
    const rows: NpsInsightFieldRow[] = [];
    const classifiedByResponse = new Map<string, number>();

    for (const raw of (data ?? []) as InsightDbRow[]) {
      const response = byId.get(raw.response_id);
      if (!response) continue;
      if (raw.field !== "reason" && raw.field !== "improvement") continue;
      if (!isCurrentTaxonomy(raw.taxonomy_version)) continue;
      rows.push({
        responseId: response.id,
        clientGroupId: response.clientGroupId,
        respondentName: response.respondentName,
        groupName: response.groupName,
        scoreRecommend: response.scoreRecommend,
        field: raw.field as NpsInsightField,
        isNoise: raw.is_noise,
        themes: parseThemes(raw.themes),
        actionable: raw.actionable,
      });
      classifiedByResponse.set(
        raw.response_id,
        (classifiedByResponse.get(raw.response_id) ?? 0) + 1
      );
    }

    let pendingCount = 0;
    for (const [id, need] of expectedById) {
      const have = classifiedByResponse.get(id) ?? 0;
      pendingCount += Math.max(0, need - have);
    }

    return {
      ...aggregateNpsCampaignInsights(rows, pendingCount),
      expectedCount: expected,
    };
  } catch (err) {
    console.error("[nps-insights] loadNpsCampaignInsights", err);
    const message = err instanceof Error ? err.message : "Falha ao carregar temas.";
    return blocked(message);
  }
}

export async function backfillNpsCampaignInsights(options: {
  responses: Array<NpsResponseRow & { groupName: string }>;
}): Promise<{
  classified: number;
  pending: number;
  expected: number;
  unavailable: boolean;
  error: string | null;
}> {
  const insights = await loadNpsCampaignInsights(options);
  if (insights.unavailable) {
    return {
      classified: 0,
      pending: insights.pendingCount,
      expected: insights.expectedCount,
      unavailable: true,
      error: insights.error,
    };
  }
  if (insights.pendingCount === 0) {
    return {
      classified: 0,
      pending: 0,
      expected: insights.expectedCount,
      unavailable: false,
      error: null,
    };
  }

  const admin = getAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("nps_response_insights")
    .select("response_id, field, taxonomy_version")
    .in(
      "response_id",
      options.responses.map((r) => r.id)
    );
  if (existingError) {
    return {
      classified: 0,
      pending: insights.pendingCount,
      expected: insights.expectedCount,
      unavailable: isMissingInsightsTable(existingError),
      error: existingError.message,
    };
  }
  const have = new Set(
    (existing ?? [])
      .filter((r) => isCurrentTaxonomy(r.taxonomy_version))
      .map((r) => `${r.response_id}:${r.field as string}`)
  );

  const pendingIds: string[] = [];
  for (const response of options.responses) {
    const needReason = Boolean(response.reason) && !have.has(`${response.id}:reason`);
    const needImprovement =
      Boolean(response.improvement) && !have.has(`${response.id}:improvement`);
    if (needReason || needImprovement) pendingIds.push(response.id);
  }

  let classified = 0;
  for (const id of pendingIds.slice(0, BACKFILL_BATCH)) {
    await classifyNpsResponseInsights(id);
    classified += 1;
  }

  const after = await loadNpsCampaignInsights(options);
  return {
    classified,
    pending: after.pendingCount,
    expected: after.expectedCount,
    unavailable: after.unavailable,
    error: after.error,
  };
}
