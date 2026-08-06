import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchNpsResults, NpsHttpError } from "@/lib/nps/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");

    const results = await fetchNpsResults({
      authUserId: user.id,
      campaignId,
    });

    return NextResponse.json(results);
  } catch (err) {
    if (err instanceof NpsHttpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao carregar resultados.";
    const status = message.includes("Não autenticado")
      ? 401
      : message.includes("Sem permissão")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
