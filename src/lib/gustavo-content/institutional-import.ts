import { findSameFact, type DedupeCandidate } from "@/lib/gustavo-content/dedupe";
import { normalizeTitleKey } from "@/lib/gustavo-content/text";

const SKIP_TITLE =
  /aula magna|oab\/|esa\/ms|afp chegamos|honor[aá]rios|para os consumidores|comiss[aã]o especial de recupera[cç][aã]o/i;

export interface InstitutionalRoteiro {
  title: string;
  link: string | null;
  content_snippet: string | null;
  published_at: string | null;
  image_url?: string | null;
}

export function shouldSkipInstitutionalTitle(title: string): boolean {
  return SKIP_TITLE.test(title);
}

function tokenOverlap(a: string, b: string): number {
  const left = new Set(normalizeTitleKey(a).split(" ").filter((token) => token.length > 2));
  const right = new Set(normalizeTitleKey(b).split(" ").filter((token) => token.length > 2));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.max(left.size, right.size);
}

export function pickInstitutionalCandidates(
  existing: DedupeCandidate[],
  roteiros: InstitutionalRoteiro[],
  max: number
): InstitutionalRoteiro[] {
  const seen: DedupeCandidate[] = [...existing];
  const picked: InstitutionalRoteiro[] = [];

  for (const roteiro of roteiros) {
    if (picked.length >= max) break;
    const title = roteiro.title?.trim() ?? "";
    if (title.length < 12) continue;
    if (shouldSkipInstitutionalTitle(title)) continue;
    if (findSameFact(seen, { title, link: roteiro.link })) continue;
    if (seen.some((item) => tokenOverlap(item.title ?? "", title) >= 0.55)) continue;

    picked.push(roteiro);
    seen.push({ title, link: roteiro.link });
  }

  return picked;
}
