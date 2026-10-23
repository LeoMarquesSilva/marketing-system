import { NextResponse } from "next/server";
import { FONT_MIME, type FontFormat } from "@/lib/estudio/fonts";
import { STUDIO_IMAGES_BUCKET } from "@/lib/estudio/images";
import { requireStudioUser } from "@/lib/estudio/server";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findFont(id: string) {
  if (!UUID_RE.test(id)) return null;
  const db = await getServerDb();
  const { data } = await db.from("studio_fonts").select("id, arquivo, formato").eq("id", id).maybeSingle();
  return data ? { db, font: data as { id: string; arquivo: string; formato: FontFormat } } : null;
}

// Arquivo da fonte enviada (só para quem usa o Estúdio). O id muda a cada envio.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const found = await findFont((await params).id);
  if (!found) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });
  const { data, error } = await found.db.storage.from(STUDIO_IMAGES_BUCKET).download(found.font.arquivo);
  if (error || !data) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });
  return new Response(data, { headers: { "Content-Type": FONT_MIME[found.font.formato], "Cache-Control": "private, max-age=31536000, immutable" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const found = await findFont((await params).id);
  if (!found) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });
  const { error } = await found.db.from("studio_fonts").delete().eq("id", found.font.id);
  if (error) return NextResponse.json({ error: "Não foi possível excluir a fonte." }, { status: 500 });
  await found.db.storage.from(STUDIO_IMAGES_BUCKET).remove([found.font.arquivo]);
  return NextResponse.json({ ok: true });
}
