import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { applyBoardAction, getConvitesBoard, parseBoardAction } from "@/lib/festa-convite-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Convites dos clientes para a festa: os de quem está logado (ou todos, para quem gerencia). */
export async function GET() {
  try {
    return NextResponse.json(await getConvitesBoard(), { headers: NO_STORE });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Marcar envio, corrigir celular, definir remetente e prazo. */
export async function POST(request: Request) {
  try {
    const action = parseBoardAction(await request.json().catch(() => null));
    if (!action) return NextResponse.json({ error: "Pedido inválido.", code: "INVALID" }, { status: 400 });
    return NextResponse.json(await applyBoardAction(action), { headers: NO_STORE });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
