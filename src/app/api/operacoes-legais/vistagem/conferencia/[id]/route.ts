import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { devolverVistagem, reenviarGravando, rodarNovamente, validarVistagem } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * acao=validar → fila do robô; acao=devolver (com motivo) → volta para o jurídico;
 * acao=reenviar → grava no VIOS as tarefas que só passaram em simulação;
 * acao=rodar_novamente (forcar opcional) → roda de novo no robô as tarefas que deram erro.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { acao?: unknown; tipo?: unknown; descricao?: unknown; forcar?: unknown } | null;
    if (corpo?.acao === "validar") return NextResponse.json(await validarVistagem(id, authUserId));
    if (corpo?.acao === "reenviar") return NextResponse.json(await reenviarGravando(id));
    if (corpo?.acao === "rodar_novamente") return NextResponse.json(await rodarNovamente(id, corpo.forcar === true));
    if (corpo?.acao === "devolver") {
      await devolverVistagem(
        id,
        { tipo: typeof corpo.tipo === "string" ? corpo.tipo : "", descricao: typeof corpo.descricao === "string" ? corpo.descricao : "" },
        authUserId
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Informe acao: validar, devolver, reenviar ou rodar_novamente." }, { status: 400 });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível concluir a conferência.");
  }
}
