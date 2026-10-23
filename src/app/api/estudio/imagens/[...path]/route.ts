import { NextResponse } from "next/server";
import { requireStudioUser } from "@/lib/estudio/server";
import { STUDIO_IMAGES_BUCKET, isStudioImagePath } from "@/lib/estudio/images";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

// Mesma origem que a página: a prévia e a exportação em PNG leem a imagem sem CORS.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const path = (await params).path.map((p) => decodeURIComponent(p)).join("/");
  if (!isStudioImagePath(path)) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });

  const db = await getServerDb();
  const { data, error } = await db.storage.from(STUDIO_IMAGES_BUCKET).download(path);
  if (error || !data) return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "image/png",
      // o nome do arquivo tem data, então o conteúdo de um caminho nunca muda
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
