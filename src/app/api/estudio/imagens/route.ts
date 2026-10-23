import { NextResponse } from "next/server";
import { requireStudioUser } from "@/lib/estudio/server";
import { getCollection } from "@/lib/estudio/templates";
import { STUDIO_IMAGES_BUCKET, STUDIO_IMAGE_MAX_BYTES, STUDIO_IMAGE_TYPES, slugifyFileName } from "@/lib/estudio/images";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

const PASTAS = new Set(["fotos", "logos"]);

function readTarget(tag: unknown, pasta: unknown) {
  if (typeof tag !== "string" || !getCollection(tag)) return null;
  if (typeof pasta !== "string" || !PASTAS.has(pasta)) return null;
  return { tag, pasta };
}

/** Galeria da coleção: o que já foi enviado na pasta (fotos de advogados, logos de clientes). */
export async function GET(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const target = readTarget(url.searchParams.get("tag"), url.searchParams.get("pasta"));
  if (!target) return NextResponse.json({ error: "Galeria inválida." }, { status: 400 });

  const db = await getServerDb();
  const { data, error } = await db.storage
    .from(STUDIO_IMAGES_BUCKET)
    .list(`${target.tag}/${target.pasta}`, { limit: 300, sortBy: { column: "created_at", order: "desc" } });
  if (error) {
    console.error("[estudio/imagens] lista", error);
    return NextResponse.json({ error: "Não foi possível carregar a galeria." }, { status: 500 });
  }
  const images = (data ?? [])
    .filter((f) => f.id && /\.(png|jpe?g|webp)$/i.test(f.name))
    .map((f) => ({ path: `${target.tag}/${target.pasta}/${f.name}` }));
  return NextResponse.json({ images });
}

/** Envia uma imagem (PNG sem fundo para fotos) para a galeria da coleção. */
export async function POST(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("arquivo");
  const target = readTarget(form?.get("tag"), form?.get("pasta"));
  if (!target || !(file instanceof File)) return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  const ext = STUDIO_IMAGE_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use PNG, JPG ou WebP." }, { status: 400 });
  if (file.size > STUDIO_IMAGE_MAX_BYTES) return NextResponse.json({ error: "A imagem passa de 10 MB." }, { status: 400 });

  const path = `${target.tag}/${target.pasta}/${Date.now()}-${slugifyFileName(file.name)}.${ext}`;
  const db = await getServerDb();
  const { error } = await db.storage
    .from(STUDIO_IMAGES_BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) {
    console.error("[estudio/imagens] envio", error);
    return NextResponse.json({ error: "Não foi possível enviar a imagem." }, { status: 500 });
  }
  return NextResponse.json({ path }, { status: 201 });
}
