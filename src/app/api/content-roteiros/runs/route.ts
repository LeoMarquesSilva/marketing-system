import { NextResponse } from "next/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { fetchRecentFetchRuns } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";

/** Últimas execuções do pipeline de busca (diagnóstico — só equipe de marketing). */
export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedContentUser();
    if (!auth || !isContentManager(auth.profile)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 10;

    const runs = await fetchRecentFetchRuns(Math.min(50, Math.max(1, limit)));
    return NextResponse.json(runs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar execuções.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
