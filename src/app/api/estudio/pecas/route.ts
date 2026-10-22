import { NextResponse } from "next/server";
import { z } from "zod";
import { createPiece, isPieceKind, listPieces, requireStudioUser } from "@/lib/estudio/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  tag: z.string().min(1).max(24),
  titulo: z.string().max(200).default(""),
  tipo: z.string().refine(isPieceKind, "Tipo de peça inválido."),
  slides: z.array(z.unknown()).max(20),
  legenda: z.string().max(5000).default(""),
});

export async function GET() {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ pieces: await listPieces() });
  } catch (error) {
    console.error("[estudio/pecas] lista", error);
    return NextResponse.json({ error: "Não foi possível carregar as peças." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPieceKind(parsed.data.tipo)) {
    return NextResponse.json({ error: "Peça inválida." }, { status: 400 });
  }
  try {
    const piece = await createPiece({ ...parsed.data, tipo: parsed.data.tipo }, auth.profile.id);
    return NextResponse.json({ piece }, { status: 201 });
  } catch (error) {
    console.error("[estudio/pecas] criar", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar a peça." }, { status: 500 });
  }
}
