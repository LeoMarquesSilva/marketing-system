import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { contestarInconsistencia, excluirInconsistencia } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** acao=contestar (jurídico) ou acao=excluir (controladoria), com o texto. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { authUserId, papel, areas } = await exigirPerfilVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { acao?: unknown; texto?: unknown } | null;
    const texto = typeof corpo?.texto === "string" ? corpo.texto : "";
    if (corpo?.acao === "contestar") await contestarInconsistencia(id, texto, authUserId, areas);
    else if (corpo?.acao === "excluir") {
      if (papel !== "controladoria") return NextResponse.json({ error: "Só a controladoria exclui inconsistências." }, { status: 403 });
      await excluirInconsistencia(id, texto, authUserId);
    } else return NextResponse.json({ error: "Informe acao: contestar ou excluir." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível atualizar a inconsistência.");
  }
}
