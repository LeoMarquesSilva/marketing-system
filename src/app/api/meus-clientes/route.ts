import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchMeusClientesPayload } from "@/lib/meus-clientes-server";

export const dynamic = "force-dynamic";

/** Dados de Meus Clientes filtrados pelo escopo do usuário logado. */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const viewAll = url.searchParams.get("viewAll") === "1";
    const filterGestorId = url.searchParams.get("gestorId") || null;

    const payload = await fetchMeusClientesPayload({
      authUserId: user.id,
      viewAll,
      filterGestorId,
    });

    return NextResponse.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar Meus Clientes.";
    const status = msg.includes("Não autenticado") ? 401 : msg.includes("Sem permissão") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
