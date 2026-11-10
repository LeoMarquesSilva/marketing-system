import { NextResponse } from "next/server";
import { HomeHttpError, saveHomeFavorites } from "@/lib/inicio/server";

export const dynamic = "force-dynamic";

/** Salva na conta os atalhos favoritos da tela inicial de quem está logado. */
export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { favorites?: unknown } | null;
    const favorites = await saveHomeFavorites(body?.favorites);
    return NextResponse.json({ favorites }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HomeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[inicio] favoritos:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível salvar os favoritos." }, { status: 500 });
  }
}
