import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarDuplicidades } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await exigirAcessoVistagem();
    const situacao = new URL(request.url).searchParams.get("situacao") === "revisadas" ? "revisadas" : "pendentes";
    return NextResponse.json({ duplicidades: await listarDuplicidades(situacao) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar as duplicidades.");
  }
}
