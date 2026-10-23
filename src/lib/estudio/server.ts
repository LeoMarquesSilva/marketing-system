import "server-only";

import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAuthenticatedContentUser, type UserContentAccess } from "@/lib/content-access";
import { isContentManager } from "@/lib/content-areas";
import { getServerDb } from "@/lib/users-server";
import { normalizeSlides } from "./domain";
import { getCollection } from "./templates";
import type { PieceKind, StudioPiece, StudioPieceSummary } from "./types";

const FONTS_DIR = path.join(process.cwd(), "src/lib/estudio/assets/fonts");

/**
 * Fontes licenciadas dos modelos ficam fora de /public e só saem para quem usa o
 * Estúdio. Enquanto o arquivo de uma fonte não estiver na pasta, a página cai na
 * reserva declarada no CSS (Montserrat para a Neulis).
 */
export const STUDIO_FONT_FILES: Record<string, { family: string; weight: number; candidates: string[] }> = {
  titulo: { family: "Estudio Neulis", weight: 700, candidates: ["NeulisNeue-Bold.otf", "NeulisNeue-Bold.ttf", "NeulisNeue-Bold.woff2"] },
  apoio: { family: "Estudio Century Gothic", weight: 400, candidates: ["CenturyGothic.ttf"] },
  // Posts do escritório (posts.ai). Sem a Gotham na pasta, o corpo sai em Montserrat.
  gobold: { family: "Estudio Gobold", weight: 400, candidates: ["Gobold-Regular.otf"] },
  "gotham-book": { family: "Estudio Gotham", weight: 400, candidates: ["Gotham-Book.otf", "Gotham-Book.ttf"] },
  "gotham-medium": { family: "Estudio Gotham", weight: 500, candidates: ["Gotham-Medium.otf", "Gotham-Medium.ttf"] },
  "gotham-bold": { family: "Estudio Gotham", weight: 700, candidates: ["Gotham-Bold.otf", "Gotham-Bold.ttf"] },
};

export async function studioFontPath(name: string): Promise<string | null> {
  const font = STUDIO_FONT_FILES[name];
  if (!font) return null;
  for (const candidate of font.candidates) {
    const fullPath = path.join(FONTS_DIR, candidate);
    try {
      await access(fullPath);
      return fullPath;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

/** @font-face só das fontes que existem na pasta (fonte ausente não vira 404 na exportação). */
export async function studioFontFaceCss(): Promise<string> {
  const rules: string[] = [];
  for (const [name, font] of Object.entries(STUDIO_FONT_FILES)) {
    const file = await studioFontPath(name);
    if (!file) continue;
    rules.push(
      `@font-face{font-family:"${font.family}";src:url("/api/estudio/fontes/${name}");font-weight:${font.weight};font-style:normal;font-display:block;}`
    );
  }
  return rules.join("\n");
}

type StudioAuth = { profile: UserContentAccess } | { error: NextResponse };

/** Estúdio é do Marketing: admin, designer ou departamento Marketing. */
export async function requireStudioUser(): Promise<StudioAuth> {
  const auth = await getAuthenticatedContentUser();
  if (!auth) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (!auth.profile || !isContentManager(auth.profile)) {
    return { error: NextResponse.json({ error: "O Estúdio de peças é só para o Marketing." }, { status: 403 }) };
  }
  return { profile: auth.profile };
}

const PIECE_COLUMNS = "id, tag, titulo, tipo, slides, legenda, request_id, roteiro_id, created_by_id, created_at, updated_at";
const KINDS: PieceKind[] = ["feed", "carrossel", "stories"];

export function isPieceKind(value: unknown): value is PieceKind {
  return KINDS.includes(value as PieceKind);
}

function toPiece(row: Record<string, unknown>): StudioPiece {
  const tipo = isPieceKind(row.tipo) ? row.tipo : "feed";
  const tag = String(row.tag ?? "");
  return {
    id: String(row.id),
    tag,
    titulo: String(row.titulo ?? ""),
    tipo,
    slides: normalizeSlides(row.slides, tag, tipo),
    legenda: String(row.legenda ?? ""),
    request_id: (row.request_id as string | null) ?? null,
    roteiro_id: (row.roteiro_id as string | null) ?? null,
    created_by_id: (row.created_by_id as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listPieces(): Promise<StudioPieceSummary[]> {
  const db = await getServerDb();
  const { data, error } = await db.from("studio_pieces").select(PIECE_COLUMNS).order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error("Não foi possível carregar as peças.");
  return (data ?? []).map((row) => {
    const piece = toPiece(row as Record<string, unknown>);
    return {
      id: piece.id,
      tag: piece.tag,
      titulo: piece.titulo,
      tipo: piece.tipo,
      request_id: piece.request_id,
      updated_at: piece.updated_at,
      slides_count: piece.slides.length,
      capa: piece.slides[0] ?? null,
    };
  });
}

export async function getPiece(id: string): Promise<StudioPiece | null> {
  const db = await getServerDb();
  const { data, error } = await db.from("studio_pieces").select(PIECE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a peça.");
  return data ? toPiece(data as Record<string, unknown>) : null;
}

export interface PieceInput {
  tag: string;
  titulo: string;
  tipo: PieceKind;
  slides: unknown;
  legenda: string;
  roteiro_id?: string | null;
  request_id?: string | null;
}

export async function createPiece(input: PieceInput, createdById: string): Promise<StudioPiece> {
  if (!getCollection(input.tag)) throw new Error("Coleção de modelos desconhecida.");
  const db = await getServerDb();
  const { data, error } = await db
    .from("studio_pieces")
    .insert({
      tag: input.tag,
      titulo: input.titulo.trim().slice(0, 120) || "Peça sem título",
      tipo: input.tipo,
      slides: normalizeSlides(input.slides, input.tag, input.tipo),
      legenda: input.legenda.slice(0, 5000),
      roteiro_id: input.roteiro_id ?? null,
      request_id: input.request_id ?? null,
      created_by_id: createdById,
    })
    .select(PIECE_COLUMNS)
    .single();
  if (error || !data) throw new Error("Não foi possível criar a peça.");
  return toPiece(data as Record<string, unknown>);
}

export async function updatePiece(
  id: string,
  patch: Partial<Pick<PieceInput, "titulo" | "slides" | "legenda">> & { request_id?: string | null }
): Promise<StudioPiece | null> {
  const current = await getPiece(id);
  if (!current) return null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.titulo !== undefined) update.titulo = patch.titulo.trim().slice(0, 120) || "Peça sem título";
  if (patch.slides !== undefined) update.slides = normalizeSlides(patch.slides, current.tag, current.tipo);
  if (patch.legenda !== undefined) update.legenda = patch.legenda.slice(0, 5000);
  if (patch.request_id !== undefined) update.request_id = patch.request_id;
  const db = await getServerDb();
  const { data, error } = await db.from("studio_pieces").update(update).eq("id", id).select(PIECE_COLUMNS).maybeSingle();
  if (error) throw new Error("Não foi possível salvar a peça.");
  return data ? toPiece(data as Record<string, unknown>) : null;
}

export async function deletePiece(id: string): Promise<void> {
  const db = await getServerDb();
  const { error } = await db.from("studio_pieces").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir a peça.");
}
