import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { updateClientGroupGestorStatus } from "@/lib/meus-clientes-server";
import type {
  GestorAtividade,
  InativoEncerramentoTipo,
} from "@/lib/client-group-gestor-status";

export const dynamic = "force-dynamic";

/** Gestor confirma status comercial do grupo (ativo/inativo). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      gestorAtividade?: GestorAtividade;
      inativoEncerramentoTipo?: InativoEncerramentoTipo | null;
      contratoVigenciaTermino?: string | null;
      rescisaoContratualData?: string | null;
    };

    if (body.gestorAtividade !== "ativo" && body.gestorAtividade !== "inativo") {
      return NextResponse.json({ error: "Informe se o grupo está ativo ou inativo." }, { status: 400 });
    }

    const status = await updateClientGroupGestorStatus({
      authUserId: user.id,
      clientGroupId: id,
      input: {
        gestorAtividade: body.gestorAtividade,
        inativoEncerramentoTipo: body.inativoEncerramentoTipo ?? null,
        contratoVigenciaTermino: body.contratoVigenciaTermino ?? null,
        rescisaoContratualData: body.rescisaoContratualData ?? null,
      },
    });

    return NextResponse.json({ success: true, status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar status do grupo.";
    const status = msg.includes("Não autenticado")
      ? 401
      : msg.includes("Sem permissão")
        ? 403
        : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
