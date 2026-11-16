import { NextResponse } from "next/server";
import { pedidosDeAbertura, pedirAberturaDaPasta } from "@/lib/vistagem/capa-abertura-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Os pedidos de abertura da pasta desta publicação ao robô (o mais novo primeiro), se a abertura de verdade está
 * ligada e, depois dela, a CI nova (a publicação fica na Triagem Manual para a responsável conferir e liberar).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json(await pedidosDeAbertura(id));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível consultar a abertura no robô.");
  }
}

/** Pede ao robô a abertura da pasta com a capa conferida: `{ modo: "simular" }` (padrão) ou `{ modo: "abrir" }` (Fase 3). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { modo?: unknown } | null;
    return NextResponse.json(await pedirAberturaDaPasta(id, authUserId, corpo?.modo === "abrir" ? "abrir" : "simular"));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível pedir a abertura ao robô.");
  }
}
