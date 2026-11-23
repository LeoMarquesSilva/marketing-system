import { z } from "zod";
import { DECISIONS, DIMENSIONS } from "./types";

/**
 * Id de alavanca/meta. Os itens do workshop têm ids gerados por md5 (para a
 * migration poder rodar de novo), que não seguem a versão/variante exigida por
 * `z.uuid()` no zod 4 — por isso o formato é conferido só pelo desenho
 * 8-4-4-4-12 em hexadecimal.
 */
export const pe27IdSchema = z
  .string({ error: "Identificador inválido." })
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Identificador inválido.");

/** Texto opcional: vazio vira null (a pessoa pode preencher aos poucos). */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: use no máximo ${max} caracteres.`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

const decisionFields = {
  status: z.enum(DECISIONS, { error: "Decisão inválida." }).optional(),
  merged_into: pe27IdSchema.nullable().optional(),
  decision_note: optionalText(2000, "Observação"),
};

export const leverPatchSchema = z.object({
  title: z.string().trim().min(1, "Escreva a alavanca.").max(200, "Alavanca: use no máximo 200 caracteres.").optional(),
  dimension: z.enum(DIMENSIONS, { error: "Dimensão inválida." }).optional(),
  ...decisionFields,
});

export const leverCreateSchema = z.object({
  dimension: z.enum(DIMENSIONS, { error: "Dimensão inválida." }),
  title: z.string().trim().min(1, "Escreva a alavanca.").max(200, "Alavanca: use no máximo 200 caracteres."),
});

export const goalPatchSchema = z.object({
  text: z.string().trim().min(1, "Escreva a meta.").max(300, "Meta: use no máximo 300 caracteres.").optional(),
  lever_id: pe27IdSchema.optional(),
  baseline: optionalText(200, "Ponto de partida"),
  target: optionalText(200, "Alvo"),
  data_source: optionalText(200, "Fonte do dado"),
  ...decisionFields,
});

export const goalCreateSchema = z.object({
  lever_id: pe27IdSchema,
  text: z.string().trim().min(1, "Escreva a meta.").max(300, "Meta: use no máximo 300 caracteres."),
});

export type LeverPatch = z.infer<typeof leverPatchSchema>;
export type LeverCreate = z.infer<typeof leverCreateSchema>;
export type GoalPatch = z.infer<typeof goalPatchSchema>;
export type GoalCreate = z.infer<typeof goalCreateSchema>;
