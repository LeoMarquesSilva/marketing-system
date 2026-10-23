import { NextResponse } from "next/server";
import { z } from "zod";
import { buildStudioPrompt, keepSlideIds } from "@/lib/estudio/ai";
import { runStudioAi, studioAiKey } from "@/lib/estudio/ai-server";
import { carryOverImages, dropDuplicateSlides, normalizeSlides } from "@/lib/estudio/domain";
import { isPieceKind, requireStudioUser } from "@/lib/estudio/server";
import { getCollection, templatesFor } from "@/lib/estudio/templates";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  tag: z.string().min(1).max(24),
  tipo: z.string(),
  titulo: z.string().max(200).default(""),
  slides: z.array(z.unknown()).max(20),
  legenda: z.string().max(5000).default(""),
  pedido: z.string().trim().min(3).max(2000),
});

export async function POST(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPieceKind(parsed.data.tipo)) {
    return NextResponse.json({ error: "Escreva o pedido para a IA." }, { status: 400 });
  }
  const { tag, titulo, legenda, pedido } = parsed.data;
  const kind = parsed.data.tipo;
  const collection = getCollection(tag);
  const templates = templatesFor(tag, kind);
  if (!collection || templates.length === 0) {
    return NextResponse.json({ error: "Não há modelos para este tipo de peça." }, { status: 400 });
  }

  const apiKey = studioAiKey();
  if (!apiKey) return NextResponse.json({ error: "A chave de IA não está configurada." }, { status: 500 });

  const slides = normalizeSlides(parsed.data.slides, tag, kind);

  try {
    const result = await runStudioAi({
      apiKey,
      kind,
      templates,
      prompt: buildStudioPrompt({ collection, kind, templates, titulo, slides, legenda, pedido }),
    });

    const nextSlides = carryOverImages(slides, keepSlideIds(slides, dropDuplicateSlides(normalizeSlides(result.slides, tag, kind))));
    if (nextSlides.length === 0) {
      return NextResponse.json({ error: "A IA não devolveu nenhum slide válido. Tente reformular o pedido." }, { status: 502 });
    }
    return NextResponse.json({
      slides: nextSlides,
      legenda: kind === "stories" ? "" : result.legenda,
      resumo: result.resumo,
    });
  } catch (error) {
    console.error("[estudio/ajustar] falha", error);
    return NextResponse.json({ error: "A IA não conseguiu ajustar a peça agora. Tente de novo." }, { status: 500 });
  }
}
