import "server-only";

import { NextResponse } from "next/server";
import { ProcessosError } from "./errors";
import { exigirAcessoProcessos, type Ator } from "./server";

function respostaDeErro(error: unknown): NextResponse {
  if (error instanceof ProcessosError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "";
  if (/não autenticado/i.test(message)) return NextResponse.json({ error: message }, { status: 401 });
  if (/sem permissão|inativo|apenas administradores/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
  console.error("[processos]", message);
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}

/** Confere o acesso, roda a ação e devolve JSON; erro vira a resposta com o status certo. */
export async function comAcesso<T>(acao: (ator: Ator) => Promise<T>): Promise<NextResponse> {
  try {
    const ator = await exigirAcessoProcessos();
    return NextResponse.json(await acao(ator));
  } catch (error) {
    return respostaDeErro(error);
  }
}

/** Como comAcesso, para rota que devolve arquivo. */
export async function comAcessoBruto(acao: (ator: Ator) => Promise<Response>): Promise<Response> {
  try {
    return await acao(await exigirAcessoProcessos());
  } catch (error) {
    return respostaDeErro(error);
  }
}

export async function lerJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const corpo = await request.json();
    if (corpo && typeof corpo === "object" && !Array.isArray(corpo)) return corpo as Record<string, unknown>;
  } catch {
    // cai no erro abaixo
  }
  throw new ProcessosError("Corpo da requisição inválido.", 400);
}
