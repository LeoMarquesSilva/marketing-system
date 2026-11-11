import { NextResponse } from "next/server";
import { pedidosDeAbertura, pedirAberturaDaPasta } from "@/lib/vistagem/capa-abertura-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/** Os pedidos de abertura da pasta desta publicação ao robô (o mais novo primeiro). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json({ pedidos: await pedidosDeAbertura(id) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível consultar a abertura no robô.");
  }
}

/** Pede ao robô a abertura da pasta com a capa conferida (Fase 2: simulação, nada é gravado no VIOS). */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json({ pedidos: await pedirAberturaDaPasta(id, authUserId) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível pedir a abertura ao robô.");
  }
}
