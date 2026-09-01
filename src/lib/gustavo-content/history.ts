import { normalizeTitleKey } from "@/lib/gustavo-content/text";

export type SimilarityRisk = "low" | "medium" | "high";

export interface HistoryCandidate {
  title?: string | null;
  thesisId?: string | null;
  angleType?: string | null;
  companies?: string[];
}

export interface HistoryItem {
  title?: string | null;
  thesis_id?: string | null;
  selected_angle?: { type?: string } | null;
  source_context?: { companies?: string[] } | null;
  created_at?: string | null;
}

export interface EditorialHistoryAssessment {
  similarityRisk: SimilarityRisk;
  similarItems: HistoryItem[];
  reason: string;
  varyAngle: boolean;
}

function tokenSet(title: string): Set<string> {
  return new Set(normalizeTitleKey(title).split(" ").filter((token) => token.length > 2));
}

function overlapRatio(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.max(left.size, right.size);
}

function companiesOf(item: HistoryItem): string[] {
  return (item.source_context?.companies ?? []).map((value) => value.toLowerCase());
}

export function assessEditorialHistory(
  candidate: HistoryCandidate,
  previous: HistoryItem[]
): EditorialHistoryAssessment {
  const title = candidate.title ?? "";
  const companies = (candidate.companies ?? []).map((value) => value.toLowerCase());
  const similar: HistoryItem[] = [];
  let risk: SimilarityRisk = "low";

  for (const item of previous) {
    const sameTitle = normalizeTitleKey(item.title ?? "") === normalizeTitleKey(title);
    const titleOverlap = overlapRatio(title, item.title ?? "");
    const sameThesis = Boolean(candidate.thesisId && item.thesis_id === candidate.thesisId);
    const sameAngle = Boolean(
      candidate.angleType && item.selected_angle?.type === candidate.angleType
    );
    const sharedCompany = companies.some((company) => companiesOf(item).includes(company));

    if (sameTitle || (sameThesis && sameAngle && (sharedCompany || titleOverlap >= 0.45))) {
      similar.push(item);
      risk = "high";
      continue;
    }
    if (sameThesis || titleOverlap >= 0.4 || (sharedCompany && sameAngle)) {
      similar.push(item);
      if (risk !== "high") risk = "medium";
    }
  }

  const reason =
    risk === "high"
      ? "Você já falou sobre este tema pelo mesmo ângulo. A geração precisa variar a leitura."
      : risk === "medium"
        ? "Há conteúdo próximo no histórico. Vale diferenciar gancho e ângulo."
        : "Sem sobreposição relevante no histórico recente.";

  return {
    similarityRisk: risk,
    similarItems: similar.slice(0, 5),
    reason,
    varyAngle: risk === "high",
  };
}

export function historyAlertText(assessment: EditorialHistoryAssessment): string | null {
  if (assessment.similarityRisk === "low" || assessment.similarItems.length === 0) {
    return null;
  }
  const previous = assessment.similarItems[0];
  const days = previous.created_at
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(previous.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;
  const angle = previous.selected_angle?.type
    ? `Ângulo anterior: ${previous.selected_angle.type}.`
    : "";
  const when = days != null ? `Você já falou sobre este tema há ${days} dias.` : "Há conteúdo próximo no histórico.";
  return `${when} ${angle} ${assessment.reason}`.trim();
}
