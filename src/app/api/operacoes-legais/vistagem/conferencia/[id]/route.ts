import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { devolverVistagem, reenviarGravando, validarVistagem } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * acao=validar → fila do robô; acao=devolver (com motivo) → volta para o jurídico;
 * acao=reenviar → grava no VIOS as tarefas que só passaram em simulação.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { acao?: unknown; motivo?: unknown } | null;
    if (corpo?.acao === "validar") return NextResponse.json(await validarVistagem(id, authUserId));
    if (corpo?.acao === "reenviar") return NextResponse.json(await reenviarGravando(id));
    if (corpo?.acao === "devolver") {
      await devolverVistagem(id, typeof corpo.motivo === "string" ? corpo.motivo : "", authUserId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Informe acao: validar, devolver ou reenviar." }, { status: 400 });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível concluir a conferência.");
  }
}
