import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireVistagemAccess } from "@/lib/api-auth";
import { VistagemError } from "./errors";

/** Usuário autenticado com acesso à Vistagem e agendamento; devolve o id de auth. */
export async function exigirAcessoVistagem(): Promise<string> {
  const user = await requireAuthenticatedUser();
  await requireVistagemAccess(user.id);
  return user.id;
}

export function respostaDeErro(error: unknown, mensagemPadrao: string): NextResponse {
  if (error instanceof VistagemError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (/não autenticado/i.test(message)) return NextResponse.json({ error: message }, { status: 401 });
  if (/sem permissão|inativo/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
  console.error("[vistagem]", message);
  return NextResponse.json({ error: mensagemPadrao }, { status: 500 });
}
