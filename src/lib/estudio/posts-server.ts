import "server-only";

import { getServerDb } from "@/lib/users-server";
import { STUDIO_IMPORT_RULES, buildImportPrompt } from "./ai";
import { runStudioAi } from "./ai-server";
import { authorCredit, cleanSourceTitle, dropDuplicateSlides, matchPhoto, missingSentences, normalizeSlides } from "./domain";
import { STUDIO_IMAGES_BUCKET } from "./images";
import { createPiece } from "./server";
import { BP_COLLECTION, templatesFor } from "./templates";
import type { StudioPiece } from "./types";

/** Posts aprovados no Gerador de conteúdo que podem virar carrossel no Estúdio. */
const IMPORTABLE_STATUSES = ["enviado_mkt", "aprovado", "aprovado_revisor"];

export interface StudioPostOption {
  id: string;
  title: string;
  area: string;
  status: string;
  author: string | null;
  date: string;
  hasRequest: boolean;
  pieceId: string | null;
}

export async function listStudioPosts(): Promise<StudioPostOption[]> {
  const db = await getServerDb();
  const { data, error } = await db
    .from("content_roteiros")
    .select("id, title, area, status, approved_by_name, sent_to_mkt_at, approved_at, created_at, marketing_request_id")
    .in("status", IMPORTABLE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error("Não foi possível carregar os posts do Gerador.");

  const ids = (data ?? []).map((r) => r.id as string);
  const pieces = new Map<string, string>();
  if (ids.length) {
    const { data: rows } = await db.from("studio_pieces").select("id, roteiro_id").in("roteiro_id", ids);
    for (const row of rows ?? []) pieces.set(row.roteiro_id as string, row.id as string);
  }

  return (data ?? [])
    .map((r) => ({
      id: r.id as string,
      title: cleanSourceTitle(String(r.title ?? "")),
      area: String(r.area ?? ""),
      status: String(r.status),
      author: (r.approved_by_name as string | null) ?? null,
      date: String(r.sent_to_mkt_at ?? r.approved_at ?? r.created_at),
      hasRequest: Boolean(r.marketing_request_id),
      pieceId: pieces.get(r.id as string) ?? null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function loadAuthor(userId: string | null, fallbackName: string | null) {
  const db = await getServerDb();
  if (userId) {
    const { data } = await db
      .from("hr_employees")
      .select("full_name, gender, position, department")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      return {
        name: String(data.full_name),
        gender: (data.gender as string | null) ?? null,
        position: (data.position as string | null) ?? null,
        department: (data.department as string | null) ?? null,
      };
    }
  }
  return fallbackName ? { name: fallbackName, gender: null, position: null, department: null } : null;
}

async function galleryPaths(folder: string): Promise<string[]> {
  const db = await getServerDb();
  const { data } = await db.storage.from(STUDIO_IMAGES_BUCKET).list(folder, { limit: 300, sortBy: { column: "created_at", order: "desc" } });
  return (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
}

/**
 * Monta um carrossel da coleção BP a partir de um post aprovado: a IA distribui o texto
 * nos modelos; área, autor e cargo vêm do post e do RH; a foto sai da galeria quando
 * houver uma com o nome da pessoa. A peça fica ligada ao post e à tarefa do planner.
 */
export async function buildPieceFromPost(roteiroId: string, createdById: string, apiKey: string): Promise<{ piece: StudioPiece; missing: string[] }> {
  const db = await getServerDb();
  const { data: post, error } = await db
    .from("content_roteiros")
    .select("id, title, area, post, status, approved_by_id, approved_by_name, marketing_request_id")
    .eq("id", roteiroId)
    .maybeSingle();
  if (error || !post) throw new Error("Post não encontrado.");
  if (!IMPORTABLE_STATUSES.includes(String(post.status))) throw new Error("Esse post ainda não foi aprovado.");
  if (!String(post.post ?? "").trim()) throw new Error("O post está sem texto.");

  const area = String(post.area ?? "").trim();
  const person = await loadAuthor((post.approved_by_id as string | null) ?? null, (post.approved_by_name as string | null) ?? null);
  const credit = person ? authorCredit(person, area) : { autor: "", cargo: area ? `Área de ${area}` : "" };
  const titulo = cleanSourceTitle(String(post.title ?? ""));

  const kind = "carrossel" as const;
  const templates = templatesFor(BP_COLLECTION.tag, kind);
  const text = String(post.post);
  const prompt = buildImportPrompt({ collection: BP_COLLECTION, templates, area, autor: credit.autor, cargo: credit.cargo, titulo, post: text });
  const attempt = async (feedback?: string[]) => {
    const result = await runStudioAi({
      apiKey,
      kind,
      templates,
      extraSystem: STUDIO_IMPORT_RULES,
      prompt: feedback?.length
        ? `${prompt}\n\nNa tentativa anterior estas frases do texto aprovado ficaram de fora. Monte de novo incluindo todas, palavra por palavra:\n${feedback.map((s) => `- ${s}`).join("\n")}`
        : prompt,
    });
    const slides = dropDuplicateSlides(normalizeSlides(result.slides, BP_COLLECTION.tag, kind));
    return { result, slides, missing: missingSentences(text, slides) };
  };

  // o texto já foi aprovado pelo advogado: se a IA deixar frase de fora, tenta mais uma vez
  let best = await attempt();
  if (best.missing.length > 0) {
    const retry = await attempt(best.missing).catch(() => null);
    if (retry && retry.slides.length > 0 && retry.missing.length < best.missing.length) best = retry;
  }
  const { result, slides, missing } = best;
  if (slides.length === 0) throw new Error("A IA não conseguiu montar os slides. Tente de novo.");
  const cover = slides[0].modelo === "bp-capa" ? slides[0] : null;
  if (cover) {
    // dados que não ficam a critério da IA
    cover.valores = { ...cover.valores, area, autor: credit.autor, cargo: credit.cargo };
    const foto = person ? matchPhoto(await galleryPaths(`${BP_COLLECTION.tag}/fotos`), person.name) : null;
    if (foto) cover.valores.foto = foto;
  }

  const piece = await createPiece(
    {
      tag: BP_COLLECTION.tag,
      titulo: titulo || "Carrossel",
      tipo: kind,
      slides,
      legenda: result.legenda ?? "",
      roteiro_id: post.id as string,
      request_id: (post.marketing_request_id as string | null) ?? null,
    },
    createdById
  );
  return { piece, missing };
}
