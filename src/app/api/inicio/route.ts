import { NextResponse } from "next/server";
import { getHomeData, HomeHttpError } from "@/lib/inicio/server";

export const dynamic = "force-dynamic";

/** Dados da tela inicial de quem está logado (pessoa, pendências, equipe e agenda). */
export async function GET() {
  try {
    return NextResponse.json(await getHomeData(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HomeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[inicio]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível carregar a tela inicial." }, { status: 500 });
  }
}
