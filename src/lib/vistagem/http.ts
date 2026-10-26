import "server-only";

import { NextResponse } from "next/server";
import type { PapelVistagem } from "@/lib/access-control";
import { requireAuthenticatedUser, requireVistagemAccess } from "@/lib/api-auth";
import { VistagemError } from "./errors";

/** Quem acessa a Vistagem: id de auth, papel e áreas (null = todas, na controladoria). */
export interface PerfilVistagem {
  authUserId: string;
  papel: PapelVistagem;
  areas: string[] | null;
}

/** Usuário da controladoria (todas as abas); o jurídico recebe 403. Devolve o id de auth. */
export async function exigirAcessoVistagem(): Promise<string> {
  const perfil = await exigirPerfilVistagem();
  if (perfil.papel !== "controladoria") throw new VistagemError("Sem permissão: esta tela é da controladoria.", 403);
  return perfil.authUserId;
}

/** Qualquer usuário da Vistagem (controladoria ou jurídico), para as rotas da aba Jurídico. */
export async function exigirPerfilVistagem(): Promise<PerfilVistagem> {
  const user = await requireAuthenticatedUser();
  const { papel, areas } = await requireVistagemAccess(user.id);
  return { authUserId: user.id, papel, areas };
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
