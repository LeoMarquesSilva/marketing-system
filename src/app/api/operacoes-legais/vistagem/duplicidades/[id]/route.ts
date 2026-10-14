import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { revisarDuplicidade } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { resultado?: unknown } | null;
    if (corpo?.resultado !== "confirmada" && corpo?.resultado !== "nao_duplicidade") {
      return NextResponse.json({ error: "Informe resultado: confirmada ou nao_duplicidade." }, { status: 400 });
    }
    await revisarDuplicidade(id, corpo.resultado, authUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível salvar a revisão.");
  }
}
