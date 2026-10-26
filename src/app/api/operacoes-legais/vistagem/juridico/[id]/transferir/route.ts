import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { transferirPublicacao } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Manda a publicação para a fila de outra área, com o motivo. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { authUserId, areas } = await exigirPerfilVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { destino?: unknown; motivo?: unknown } | null;
    await transferirPublicacao(
      id,
      {
        destino: typeof corpo?.destino === "string" ? corpo.destino : "",
        motivo: typeof corpo?.motivo === "string" ? corpo.motivo : "",
      },
      authUserId,
      areas
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível transferir a publicação.");
  }
}
