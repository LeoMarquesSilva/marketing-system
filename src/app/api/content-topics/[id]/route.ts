import { NextResponse } from "next/server";
import { updateContentTopic } from "@/lib/content-topics";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { topicInputSchema } from "@/lib/content-generator/topics";

export const dynamic = "force-dynamic";

/**
 * Edita ou pausa uma fonte. Não há exclusão: as matérias que a fonte já gerou
 * continuam ligadas a ela (pausar tem o mesmo efeito na busca).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isContentManager(auth.profile)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  const parsed = topicInputSchema.partial().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    const topic = await updateContentTopic(id, parsed.data);
    return NextResponse.json(topic);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar a fonte.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
