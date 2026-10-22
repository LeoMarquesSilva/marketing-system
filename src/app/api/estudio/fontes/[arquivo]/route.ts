import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireStudioUser, studioFontPath } from "@/lib/estudio/server";

export const dynamic = "force-dynamic";

// Fontes licenciadas dos modelos (Century Gothic, Neulis) só saem para quem usa o Estúdio.
export async function GET(_request: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const { arquivo } = await params;
  const fullPath = await studioFontPath(arquivo);
  if (!fullPath) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  const bytes = await readFile(fullPath);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "font/sfnt", "Cache-Control": "private, max-age=86400" },
  });
}
