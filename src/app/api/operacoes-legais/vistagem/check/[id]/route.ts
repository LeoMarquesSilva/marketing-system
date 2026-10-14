import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { apontarErroAgendamento, checarPublicacao } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/** acao=ok (check com nota opcional) ou acao=erro (tipo, subtipo e descrição da inconsistência). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (corpo?.acao === "ok") await checarPublicacao(id, texto(corpo.nota) || null, authUserId);
    else if (corpo?.acao === "erro") {
      await apontarErroAgendamento(id, { tipo: texto(corpo.tipo), subtipo: texto(corpo.subtipo), descricao: texto(corpo.descricao) }, authUserId);
    } else return NextResponse.json({ error: "Informe acao: ok ou erro." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível registrar o check.");
  }
}
