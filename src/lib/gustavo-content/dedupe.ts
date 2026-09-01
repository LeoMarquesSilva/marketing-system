import { normalizeTitleKey } from "@/lib/gustavo-content/text";

export interface DedupeCandidate {
  title?: string | null;
  link?: string | null;
}

export function normalizeLink(link: string | null | undefined): string {
  if (!link) return "";
  try {
    const url = new URL(link);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return link.trim().toLowerCase();
  }
}

export function isSameFact(a: DedupeCandidate, b: DedupeCandidate): boolean {
  const aLink = normalizeLink(a.link);
  const bLink = normalizeLink(b.link);
  if (aLink && bLink && aLink === bLink) return true;

  const aTitle = normalizeTitleKey(a.title ?? "");
  const bTitle = normalizeTitleKey(b.title ?? "");
  if (aTitle && bTitle && aTitle === bTitle) return true;

  return false;
}

export function findSameFact<T extends DedupeCandidate>(
  existing: T[],
  candidate: DedupeCandidate
): T | null {
  return existing.find((item) => isSameFact(item, candidate)) ?? null;
}
