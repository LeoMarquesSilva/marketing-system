import { GustavoContentError } from "@/lib/gustavo-content/errors";

export const THESIS_STATUSES = ["validated", "pending", "disabled"] as const;
export type ThesisStatus = (typeof THESIS_STATUSES)[number];

export const THESIS_CONVICTIONS = ["strong", "contextual", "discussion"] as const;
export type ThesisConviction = (typeof THESIS_CONVICTIONS)[number];

export const THESIS_STATUS_LABELS: Record<ThesisStatus, string> = {
  validated: "Validada",
  pending: "Pendente",
  disabled: "Desativada",
};

export const THESIS_CONVICTION_LABELS: Record<ThesisConviction, string> = {
  strong: "Forte",
  contextual: "Contextual",
  discussion: "Em discussão",
};

export interface GustavoThesis {
  id: string;
  title: string;
  thesis: string;
  explanation: string | null;
  business_importance: string | null;
  counterpoint: string | null;
  applications: string[];
  tags: string[];
  conviction: ThesisConviction;
  status: ThesisStatus;
  gustavo_phrases: string[];
  usage_count: number;
  last_used_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThesisInput {
  title?: unknown;
  thesis?: unknown;
  explanation?: unknown;
  business_importance?: unknown;
  counterpoint?: unknown;
  applications?: unknown;
  tags?: unknown;
  conviction?: unknown;
  status?: unknown;
  gustavo_phrases?: unknown;
}

export interface ValidatedThesisInput {
  title: string;
  thesis: string;
  explanation: string | null;
  business_importance: string | null;
  counterpoint: string | null;
  applications: string[];
  tags: string[];
  conviction: ThesisConviction;
  status: ThesisStatus;
  gustavo_phrases: string[];
}

export function parseTagList(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw.map((item) => String(item))
    : String(raw ?? "").split(/[,;\n]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function validateThesisInput(input: ThesisInput): ValidatedThesisInput {
  const title = String(input.title ?? "").trim();
  const thesis = String(input.thesis ?? "").trim();
  if (!title) {
    throw new GustavoContentError("Informe o título da tese.", 400);
  }
  if (!thesis) {
    throw new GustavoContentError("Informe o texto da tese.", 400);
  }

  const status = (input.status ?? "pending") as string;
  if (!THESIS_STATUSES.includes(status as ThesisStatus)) {
    throw new GustavoContentError("Status da tese inválido.", 400);
  }

  const conviction = (input.conviction ?? "contextual") as string;
  if (!THESIS_CONVICTIONS.includes(conviction as ThesisConviction)) {
    throw new GustavoContentError("Convicção da tese inválida.", 400);
  }

  return {
    title,
    thesis,
    explanation: optionalText(input.explanation),
    business_importance: optionalText(input.business_importance),
    counterpoint: optionalText(input.counterpoint),
    applications: parseTagList(input.applications),
    tags: parseTagList(input.tags),
    conviction: conviction as ThesisConviction,
    status: status as ThesisStatus,
    gustavo_phrases: parseTagList(input.gustavo_phrases),
  };
}

export function filterTheses<
  T extends Pick<GustavoThesis, "id" | "title" | "thesis" | "status" | "tags" | "applications">,
>(theses: T[], filters: { status?: string; tag?: string; query?: string }): T[] {
  const status = filters.status?.trim();
  const tag = filters.tag?.trim().toLowerCase();
  const query = filters.query?.trim().toLowerCase();

  return theses.filter((item) => {
    if (status && item.status !== status) return false;
    if (tag) {
      const hay = [...item.tags, ...("applications" in item ? item.applications : [])].map(
        (value) => value.toLowerCase()
      );
      if (!hay.includes(tag)) return false;
    }
    if (query) {
      const blob = `${item.title} ${item.thesis}`.toLowerCase();
      if (!blob.includes(query)) return false;
    }
    return true;
  });
}

export function thesisSnapshot(thesis: Pick<GustavoThesis, "title" | "thesis">): string {
  return `${thesis.title.trim()}\n\n${thesis.thesis.trim()}`;
}
