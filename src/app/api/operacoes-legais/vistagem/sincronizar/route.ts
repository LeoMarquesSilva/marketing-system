import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { sincronizarKurierSharePoint } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Botão "Buscar no SharePoint": mesma rotina do cron, sob demanda. */
export async function POST() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await sincronizarKurierSharePoint());
  } catch (error) {
    return respostaDeErro(error, "Não foi possível buscar os arquivos no SharePoint.");
  }
}
