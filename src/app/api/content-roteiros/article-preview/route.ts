import { NextResponse } from "next/server";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { fetchRoteiroArticlePreview } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Resumo longo da matéria para o sócio avaliar no boletim. */
export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedContentUser();
    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const preview = await fetchRoteiroArticlePreview(id);
    return NextResponse.json(preview);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar o resumo.";
    const status = msg === "Notícia não encontrada." ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
