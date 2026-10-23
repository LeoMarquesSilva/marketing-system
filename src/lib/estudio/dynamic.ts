import { z } from "zod";
import { IMAGE_PATH_RE, type StudioField } from "./fields";
import { FONT_FAMILY_RE } from "./fonts";
import type { DynamicBox, DynamicFont, PieceKind, StudioCollection, StudioTemplateDef } from "./types";

/**
 * Modelos e coleções criados na tela Modelos (sem código). Ficam no banco
 * (studio_templates / studio_collections) e viram StudioTemplateDef iguais aos do
 * código, com o desenho genérico de templates/dynamic.tsx.
 */

export const TAG_RE = /^[A-Z0-9]{2,12}$/;

const font = z.object({
  familia: z.string().regex(FONT_FAMILY_RE),
  peso: z.number().int().min(100).max(900),
  estilo: z.enum(["normal", "italic"]),
});

const box = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    tipo: z.enum(["texto", "imagem"]),
    label: z.string().trim().min(1).max(60),
    dica: z.string().trim().max(200).optional(),
    x: z.number().min(-50).max(1130),
    y: z.number().min(-50).max(1970),
    w: z.number().min(8).max(1180),
    h: z.number().min(8).max(2020),
    exemplo: z.string().max(1500),
    max: z.number().int().min(1).max(1500).optional(),
    linhas: z.number().int().min(1).max(30).optional(),
    fonte: font.optional(),
    tamanho: z.number().min(6).max(400).optional(),
    minimo: z.number().min(6).max(400).optional(),
    entrelinha: z.number().min(0.7).max(3).optional(),
    cor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    alinhamento: z.enum(["left", "center", "right", "justify"]).optional(),
    caixaAlta: z.boolean().optional(),
    pasta: z.enum(["fotos", "logos"]).optional(),
    ajuste: z.enum(["cover", "contain"]).optional(),
  })
  .refine((b) => b.tipo === "imagem" || (b.fonte && b.tamanho && b.max), { message: "Caixa de texto sem fonte, tamanho ou limite." });

export const templateInputSchema = z.object({
  id: z
    .string()
    .regex(/^m-[a-z0-9-]{3,60}$/)
    .optional(),
  tag: z.string().regex(TAG_RE),
  nome: z.string().trim().min(2).max(60),
  descricao: z.string().trim().max(400),
  formato: z.enum(["feed", "story"]),
  uso: z.array(z.enum(["feed", "carrossel", "stories"])).min(1),
  fundo: z.string().regex(IMAGE_PATH_RE),
  caixas: z
    .array(box)
    .min(1)
    .max(30)
    .refine((list) => new Set(list.map((b) => b.key)).size === list.length, { message: "Dois campos com o mesmo nome." }),
});

export type TemplateInput = z.infer<typeof templateInputSchema>;

export const collectionInputSchema = z.object({
  tag: z.string().regex(TAG_RE),
  nome: z.string().trim().min(2).max(80),
  contexto: z.string().trim().max(4000),
  planner: z.enum(["tag", "posts"]),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;

export interface DynamicTemplateRow extends TemplateInput {
  id: string;
  ativo: boolean;
}

/** Pilha de fontes do CSS: a do modelo e, se faltar, a Montserrat do Estúdio. */
export function fontStack(f: DynamicFont | undefined): string {
  return f ? `"${f.familia}", var(--font-estudio-titulo), sans-serif` : "var(--font-estudio-titulo), sans-serif";
}

function boxField(b: DynamicBox): StudioField {
  if (b.tipo === "imagem") return { kind: "imagem", key: b.key, label: b.label, pasta: b.pasta ?? "fotos", dica: b.dica };
  return {
    kind: "texto",
    key: b.key,
    label: b.label,
    max: b.max ?? 200,
    multilinha: (b.linhas ?? 1) > 1,
    dica: [b.dica, b.caixaAlta ? "em caixa alta" : null, b.linhas ? `até ${b.linhas} ${b.linhas === 1 ? "linha" : "linhas"}` : null].filter(Boolean).join(". ") || undefined,
  };
}

const USO_FORMATO: Record<"feed" | "story", PieceKind[]> = { feed: ["feed", "carrossel"], story: ["stories"] };

export function toTemplateDef(row: DynamicTemplateRow): StudioTemplateDef {
  const caixas = row.caixas as DynamicBox[];
  return {
    id: row.id,
    tag: row.tag,
    nome: row.nome,
    descricao: row.descricao || row.nome,
    formato: row.formato,
    // stories não usa prancheta de feed e vice-versa
    usoEm: row.uso.filter((u) => USO_FORMATO[row.formato].includes(u)),
    campos: caixas.map(boxField),
    exemplo: Object.fromEntries(caixas.map((b) => [b.key, b.exemplo])),
    ajustes: ["texto", "y"],
    layout: { fundo: row.fundo, caixas },
    inativo: !row.ativo,
  };
}

export function toCollection(row: CollectionInput): StudioCollection {
  return { tag: row.tag, nome: row.nome, contexto: row.contexto, planner: row.planner };
}

/** "Título da notícia" → "titulo_da_noticia" (nome do campo, único na lista). */
export function fieldKey(label: string, taken: Set<string>): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "c_$1")
      .slice(0, 32) || "campo";
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
  return key;
}
