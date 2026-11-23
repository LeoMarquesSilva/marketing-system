import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AudienciasError, exigirAcessoPauta, exigirAdmin, type Ator } from "./server";

export function respostaDeErro(error: unknown): NextResponse {
  if (error instanceof AudienciasError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (/não autenticado/i.test(message)) return NextResponse.json({ error: message }, { status: 401 });
  if (/sem permissão|inativo|apenas administradores/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
  console.error("[pauta]", message);
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}

export async function comAcesso<T>(acao: (ator: Ator) => Promise<T>): Promise<NextResponse> {
  try {
    const ator = await exigirAcessoPauta();
    return NextResponse.json(await acao(ator));
  } catch (error) {
    return respostaDeErro(error);
  }
}

export async function comAdmin<T>(acao: (ator: Ator) => Promise<T>): Promise<NextResponse> {
  return comAcesso(async (ator) => {
    exigirAdmin(ator);
    return acao(ator);
  });
}

export async function lerJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const corpo = await request.json();
    if (corpo && typeof corpo === "object" && !Array.isArray(corpo)) return corpo as Record<string, unknown>;
  } catch {
    // cai no erro abaixo
  }
  throw new AudienciasError("Corpo da requisição inválido.", 400);
}

/**
 * O robô da pauta roda na máquina dos robôs (fora da Vercel) e usa o mesmo token do robô de autos
 * (ROBO_AUTOS_TOKEN). Ele nunca recebe a service role; a credencial do tribunal fica na máquina dele.
 */
export function exigirRobo(request: Request): void {
  const esperado = process.env.ROBO_AUTOS_TOKEN?.trim() ?? "";
  if (esperado.length < 24) throw new AudienciasError("O robô não está habilitado neste ambiente (ROBO_AUTOS_TOKEN).", 503);
  const recebido = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const [a, b] = [Buffer.from(recebido), Buffer.from(esperado)];
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AudienciasError("Não autorizado.", 401);
}
