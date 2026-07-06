import { NextResponse } from "next/server";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

/** Admin — remove pessoa (email_people). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    await requireAdminUser(user.id);
    const { id } = await context.params;

    const admin = getAdminClient();
    const { error } = await admin.from("email_people").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir pessoa.";
    const status = msg.includes("Não autenticado")
      ? 401
      : msg.includes("administradores")
        ? 403
        : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
