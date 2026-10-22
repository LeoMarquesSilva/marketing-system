import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePiece, getPiece, requireStudioUser, updatePiece } from "@/lib/estudio/server";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const patchSchema = z.object({
  titulo: z.string().max(200).optional(),
  slides: z.array(z.unknown()).max(20).optional(),
  legenda: z.string().max(5000).optional(),
  request_id: z.string().uuid().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Peça inválida." }, { status: 400 });
  try {
    const piece = await getPiece(id.data);
    if (!piece) return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
    return NextResponse.json({ piece });
  } catch (error) {
    console.error("[estudio/pecas] abrir", error);
    return NextResponse.json({ error: "Não foi possível carregar a peça." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const id = idSchema.safeParse((await params).id);
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Alteração inválida." }, { status: 400 });
  try {
    const piece = await updatePiece(id.data, body.data);
    if (!piece) return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
    return NextResponse.json({ piece });
  } catch (error) {
    console.error("[estudio/pecas] salvar", error);
    return NextResponse.json({ error: "Não foi possível salvar a peça." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Peça inválida." }, { status: 400 });
  try {
    await deletePiece(id.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[estudio/pecas] excluir", error);
    return NextResponse.json({ error: "Não foi possível excluir a peça." }, { status: 500 });
  }
}
