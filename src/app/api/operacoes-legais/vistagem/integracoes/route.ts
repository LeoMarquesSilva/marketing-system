import { NextResponse } from "next/server";
import { verificarIntegracoes } from "@/lib/vistagem/diagnostico";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";

/** Situação das conexões da vistagem (SharePoint, SIOE, SAMA). */
export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json({ integracoes: await verificarIntegracoes() });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível verificar as integrações.");
  }
}
