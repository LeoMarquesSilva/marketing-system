import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { rodarRodadaDaKurier } from "@/lib/vistagem/rodada-kurier-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Botão "Buscar no SharePoint": a mesma rodada do cron, sob demanda (pastas do VIOS, importação, triagem,
 * Central, BKP do SIOE, sugestões e envios), para o dia em que o cron não rodou ficar completo.
 */
export async function POST() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await rodarRodadaDaKurier());
  } catch (error) {
    return respostaDeErro(error, "Não foi possível buscar os arquivos no SharePoint.");
  }
}
