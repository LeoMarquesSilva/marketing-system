import { GustavoContentError } from "@/lib/gustavo-content/errors";

export const VOICE_SOURCE_TYPES = ["linkedin", "manual", "transcript", "other"] as const;
export type VoiceSourceType = (typeof VOICE_SOURCE_TYPES)[number];

export const VOICE_AUTHENTICITIES = [
  "gustavo_original",
  "marketing_revised",
  "ai_assisted",
  "unknown",
] as const;
export type VoiceAuthenticity = (typeof VOICE_AUTHENTICITIES)[number];

export const VOICE_SOURCE_LABELS: Record<VoiceSourceType, string> = {
  linkedin: "LinkedIn",
  manual: "Manual",
  transcript: "Transcrição",
  other: "Outro",
};

export const VOICE_AUTH_LABELS: Record<VoiceAuthenticity, string> = {
  gustavo_original: "Original do Gustavo",
  marketing_revised: "Revisado pelo marketing",
  ai_assisted: "Assistido por IA",
  unknown: "Desconhecida",
};

export interface GustavoVoiceSample {
  id: string;
  source_type: VoiceSourceType;
  source_url: string | null;
  published_at: string | null;
  original_text: string;
  content_type: string | null;
  tone: string | null;
  analysis: Record<string, unknown> | null;
  performance: Record<string, unknown> | null;
  authenticity: VoiceAuthenticity;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceInput {
  original_text?: unknown;
  source_type?: unknown;
  source_url?: unknown;
  published_at?: unknown;
  content_type?: unknown;
  tone?: unknown;
  authenticity?: unknown;
  is_active?: unknown;
}

export interface ValidatedVoiceInput {
  original_text: string;
  source_type: VoiceSourceType;
  source_url: string | null;
  published_at: string | null;
  content_type: string | null;
  tone: string | null;
  authenticity: VoiceAuthenticity;
  is_active: boolean;
}

export function excerptVoice(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const cut = slice.lastIndexOf(" ");
  const base = cut >= Math.floor(max * 0.6) ? slice.slice(0, cut) : slice;
  return `${base.trimEnd()}…`;
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function validateVoiceInput(input: VoiceInput): ValidatedVoiceInput {
  const original_text = String(input.original_text ?? "").trim();
  if (!original_text) {
    throw new GustavoContentError("Cole o texto original do Gustavo.", 400);
  }

  const source_type = (input.source_type ?? "manual") as string;
  if (!VOICE_SOURCE_TYPES.includes(source_type as VoiceSourceType)) {
    throw new GustavoContentError("Tipo da amostra inválido.", 400);
  }

  const authenticity = (input.authenticity ?? "unknown") as string;
  if (!VOICE_AUTHENTICITIES.includes(authenticity as VoiceAuthenticity)) {
    throw new GustavoContentError("Autenticidade inválida.", 400);
  }

  const publishedRaw = optionalText(input.published_at);
  let published_at: string | null = null;
  if (publishedRaw) {
    const date = new Date(publishedRaw);
    if (Number.isNaN(date.getTime())) {
      throw new GustavoContentError("Data da amostra inválida.", 400);
    }
    published_at = date.toISOString();
  }

  return {
    original_text,
    source_type: source_type as VoiceSourceType,
    source_url: optionalText(input.source_url),
    published_at,
    content_type: optionalText(input.content_type),
    tone: optionalText(input.tone),
    authenticity: authenticity as VoiceAuthenticity,
    is_active: input.is_active === false ? false : true,
  };
}
