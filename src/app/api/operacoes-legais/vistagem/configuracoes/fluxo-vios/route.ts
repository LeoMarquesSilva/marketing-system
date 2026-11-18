import { NextResponse } from "next/server";
import { exigirAdminVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { atualizarFluxoVios, situacaoDoFluxoVios } from "@/lib/vistagem/rotina-vios-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Fluxo de tarefas do VIOS (só admin): última leitura no SAMA e o que o robô está fazendo. */
export async function GET() {
  try {
    await exigirAdminVistagem();
    return NextResponse.json(await situacaoDoFluxoVios(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível consultar o fluxo de tarefas do VIOS.");
  }
}

/** "Atualizar agora": roda a rotina de domingo do robô (fluxo, etiquetas, responsáveis, matérias e catálogo). */
export async function POST() {
  try {
    const authUserId = await exigirAdminVistagem();
    const resultado = await atualizarFluxoVios();
    console.info(`[vistagem] fluxo do VIOS: atualização pedida por ${authUserId}${resultado.jaRodando ? " (já estava rodando)" : ""}`);
    return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível pedir a atualização do fluxo de tarefas do VIOS.");
  }
}
