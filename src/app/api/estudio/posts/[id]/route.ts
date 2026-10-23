import { NextResponse } from "next/server";
import { z } from "zod";
import { studioAiKey } from "@/lib/estudio/ai-server";
import { buildPieceFromPost } from "@/lib/estudio/posts-server";
import { requireStudioUser } from "@/lib/estudio/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Monta um carrossel novo (coleção BP) a partir do post aprovado. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Post inválido." }, { status: 400 });

  const apiKey = studioAiKey();
  if (!apiKey) return NextResponse.json({ error: "A chave de IA não está configurada." }, { status: 500 });

  try {
    const { piece, missing } = await buildPieceFromPost(id.data, auth.profile.id, apiKey);
    return NextResponse.json({ piece, faltando: missing }, { status: 201 });
  } catch (error) {
    console.error("[estudio/posts] montar", error);
    const message = error instanceof Error ? error.message : "";
    const known = /não encontrado|não foi aprovado|sem texto|não conseguiu/i.test(message);
    return NextResponse.json({ error: known ? message : "Não foi possível montar o carrossel agora. Tente de novo." }, { status: known ? 400 : 500 });
  }
}
