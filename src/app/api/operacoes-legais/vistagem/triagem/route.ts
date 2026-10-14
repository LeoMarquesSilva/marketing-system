import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { triarPublicacoes } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Roda a triagem agora: captadas ainda não triadas e as que estavam sem pasta. */
export async function POST() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await triarPublicacoes({ incluirSemPasta: true }));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível rodar a triagem.");
  }
}
