import { NextResponse } from "next/server";
import { contarAbasDaVistagem } from "@/lib/vistagem/contagens-server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";

/** Números das abas da Vistagem no cabeçalho (quanto falta para zerar cada uma), conforme o perfil de quem pede. */
export async function GET() {
  try {
    const perfil = await exigirPerfilVistagem();
    return NextResponse.json(await contarAbasDaVistagem(perfil), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível contar as abas da Vistagem.");
  }
}
