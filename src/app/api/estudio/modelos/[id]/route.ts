import { NextResponse } from "next/server";
import { STUDIO_IMAGES_BUCKET } from "@/lib/estudio/images";
import { invalidateDynamicTemplates, requireStudioUser } from "@/lib/estudio/server";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

const ID_RE = /^m-[a-z0-9-]{3,60}$/;

/** Ativa ou desativa (o modelo desativado some da escolha; as peças continuam abrindo). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { ativo?: unknown } | null;
  if (!ID_RE.test(id) || typeof body?.ativo !== "boolean") return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const db = await getServerDb();
  const { data, error } = await db.from("studio_templates").update({ ativo: body.ativo, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível mudar o modelo." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
  invalidateDynamicTemplates();
  return NextResponse.json({ ok: true });
}

/** Exclui só modelo que nenhuma peça usa (senão os slides sumiriam); para os outros, desative. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const db = await getServerDb();
  const { count, error: countError } = await db.from("studio_pieces").select("id", { count: "exact", head: true }).contains("slides", JSON.stringify([{ modelo: id }]));
  if (countError) return NextResponse.json({ error: "Não foi possível conferir as peças." }, { status: 500 });
  if (count) {
    return NextResponse.json({ error: `${count} ${count === 1 ? "peça usa" : "peças usam"} este modelo. Desative em vez de excluir.` }, { status: 409 });
  }
  const { data, error } = await db.from("studio_templates").delete().eq("id", id).select("fundo").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível excluir o modelo." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
  await db.storage.from(STUDIO_IMAGES_BUCKET).remove([data.fundo as string]);
  invalidateDynamicTemplates();
  return NextResponse.json({ ok: true });
}
