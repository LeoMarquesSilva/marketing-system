import { z } from "zod";

export const REEL_STUDIO_STATUSES = ["draft", "reviewed", "teleprompter_ready"] as const;
export type ReelStudioStatus = (typeof REEL_STUDIO_STATUSES)[number];

export interface ReelStudioAssignee {
  user_id: string;
  user_name: string;
}

export interface ReelStudioItem {
  id: string;
  production_month: string;
  title: string;
  area: string | null;
  original_script: string;
  refined_script: string | null;
  caption: string | null;
  cover_prompt: string | null;
  cover_image_url: string | null;
  status: ReelStudioStatus;
  created_at: string;
  updated_at: string;
  assignees: ReelStudioAssignee[];
}

export const reelStudioCreateSchema = z.object({
  production_month: z.string().regex(/^\d{4}-\d{2}-01$/),
  title: z.string().trim().min(4).max(240),
  area: z.string().trim().max(120).optional().nullable(),
  original_script: z.string().trim().min(80).max(24_000),
  collaborator_ids: z.array(z.string().uuid()).min(1).max(8),
});

export const reelStudioUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(4).max(240).optional(),
  area: z.string().trim().max(120).nullable().optional(),
  original_script: z.string().trim().min(80).max(24_000).optional(),
  refined_script: z.string().trim().min(80).max(24_000).nullable().optional(),
  caption: z.string().trim().max(5_000).nullable().optional(),
  cover_prompt: z.string().trim().max(5_000).nullable().optional(),
  cover_image_url: z.string().url().max(5_000).nullable().optional(),
  status: z.enum(REEL_STUDIO_STATUSES).optional(),
  collaborator_ids: z.array(z.string().uuid()).min(1).max(8).optional(),
});

export const reelStudioRefinementSchema = z.object({
  roteiro_refinado: z.string().min(80).max(24_000),
  ajustes_realizados: z.array(z.string().min(3).max(400)).max(8),
});

export const reelStudioAssetsSchema = z.object({
  legenda: z.string().min(40).max(5_000),
  prompt_capa: z.string().min(40).max(2_000),
});

export const REEL_STUDIO_REFINEMENT_PROMPT = `Você é editor de roteiros de Reels jurídicos do escritório Bismarchi | Pires Sociedade de Advogados.

Receberá um roteiro escrito por um advogado. Reescreva-o para teleprompter, preservando integralmente os fatos, condicionantes, prazos e ressalvas presentes no material. Não acrescente informações jurídicas, números, decisões, teses ou promessas.

O público prioritário são empresários, sócios e gestores. Transforme juridiquês em clareza operacional: diga o que muda, qual o risco ou oportunidade e quando faz sentido buscar análise especializada. Use frases naturais, parágrafos curtos e uma fala segura, sem emojis, sensacionalismo ou urgência artificial.

Feche convidando uma conversa qualificada com o escritório, sem garantir resultado. O texto final deve estar pronto para leitura em teleprompter.`;

export const REEL_STUDIO_ASSETS_PROMPT = `Você cria ativos de publicação para Reels jurídicos do escritório Bismarchi | Pires Sociedade de Advogados.

Com base exclusivamente no roteiro recebido, escreva uma legenda em português do Brasil que comece por uma ideia forte, explique a relevância empresarial do tema e termine com um convite sóbrio para conversar com o escritório. Use no máximo 5 hashtags pertinentes. Não use emojis, promessas de resultado, urgência artificial ou fatos que não existam no roteiro.

Também produza um prompt visual em português para uma capa vertical 2:3. A capa deve ter linguagem editorial corporativa, composição limpa, contraste alto e espaço negativo pensado para sobrepor depois um título curto em português. Nunca peça para a imagem gerar texto, logotipos ou marcas.`;

export function formatReelMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

export function currentReelMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
