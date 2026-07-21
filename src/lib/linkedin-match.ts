import type { InstagramPost } from "@/lib/instagram-posts";
import type { ParsedLinkedinPost } from "@/lib/linkedin-types";

const MATCH_TIME_ZONE = "America/Sao_Paulo";

export interface LinkedinInstagramMatch {
  instagramPostId: string;
  confidence: number;
  strategy: "exact_caption_date" | "caption_date" | "caption_near_date";
}

export function normalizeLinkedinCaption(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordShingles(value: string): Set<string> {
  const words = value.split(" ").filter((word) => word.length > 1);
  if (words.length < 2) return new Set(words);
  const shingles = new Set<string>();
  for (let index = 0; index < words.length - 1; index += 1) {
    shingles.add(`${words[index]} ${words[index + 1]}`);
  }
  return shingles;
}

export function captionSimilarity(left: string | null, right: string | null): number {
  const normalizedLeft = normalizeLinkedinCaption(left);
  const normalizedRight = normalizeLinkedinCaption(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftSet = wordShingles(normalizedLeft);
  const rightSet = wordShingles(normalizedRight);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let intersection = 0;
  for (const shingle of leftSet) {
    if (rightSet.has(shingle)) intersection += 1;
  }
  return (2 * intersection) / (leftSet.size + rightSet.size);
}

function dateKey(date: Date, timeZone?: string): string {
  if (!timeZone) return date.toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayNumber(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`) / 86_400_000;
}

export function linkedinInstagramDateDistance(
  linkedinPublishedAt: string | null,
  instagramPublishedAt: string | null
): number {
  if (!linkedinPublishedAt || !instagramPublishedAt) return Number.POSITIVE_INFINITY;
  const linkedinDate = new Date(linkedinPublishedAt);
  const instagramDate = new Date(instagramPublishedAt);
  if (Number.isNaN(linkedinDate.getTime()) || Number.isNaN(instagramDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const linkedinKey = dateKey(linkedinDate);
  const instagramUtcKey = dateKey(instagramDate);
  const instagramLocalKey = dateKey(instagramDate, MATCH_TIME_ZONE);
  return Math.min(
    Math.abs(dayNumber(linkedinKey) - dayNumber(instagramUtcKey)),
    Math.abs(dayNumber(linkedinKey) - dayNumber(instagramLocalKey))
  );
}

export function matchLinkedinPostToInstagram(
  linkedinPost: ParsedLinkedinPost,
  candidates: InstagramPost[],
  excludedInstagramIds: ReadonlySet<string> = new Set()
): LinkedinInstagramMatch | null {
  const normalizedLinkedin = normalizeLinkedinCaption(linkedinPost.caption);
  if (!normalizedLinkedin) return null;

  const ranked = candidates
    .filter((candidate) => !excludedInstagramIds.has(candidate.id))
    .map((candidate) => ({
      candidate,
      textScore: captionSimilarity(linkedinPost.caption, candidate.caption),
      dayDistance: linkedinInstagramDateDistance(
        linkedinPost.published_at,
        candidate.published_at
      ),
      exactCaption: normalizedLinkedin === normalizeLinkedinCaption(candidate.caption),
    }))
    .filter((item) => item.dayDistance <= 3)
    .sort(
      (left, right) =>
        Number(right.exactCaption) - Number(left.exactCaption) ||
        right.textScore - left.textScore ||
        left.dayDistance - right.dayDistance
    );

  const best = ranked[0];
  if (!best) return null;

  if (best.exactCaption && best.dayDistance <= 1) {
    return {
      instagramPostId: best.candidate.id,
      confidence: best.dayDistance === 0 ? 1 : 0.98,
      strategy: "exact_caption_date",
    };
  }

  if (best.textScore >= 0.72 && best.dayDistance <= 1) {
    return {
      instagramPostId: best.candidate.id,
      confidence: Math.min(0.97, 0.68 + best.textScore * 0.25 + (best.dayDistance === 0 ? 0.04 : 0)),
      strategy: "caption_date",
    };
  }

  if (best.textScore >= 0.9 && best.dayDistance <= 3) {
    return {
      instagramPostId: best.candidate.id,
      confidence: Math.min(0.94, 0.66 + best.textScore * 0.25),
      strategy: "caption_near_date",
    };
  }

  return null;
}
