import { NextResponse } from "next/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { refreshLearning } from "@/lib/content-generator/server";

export const dynamic = "force-dynamic";
// A IA lê um ano de Instagram, as escolhas e as correções: leva perto de um minuto.
export const maxDuration = 180;

/** "Atualizar aprendizado agora" na tela de Configurações. */
export async function POST() {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isContentManager(auth.profile)) {
    return NextResponse.json({ error: "Só a equipe de Marketing atualiza o aprendizado." }, { status: 403 });
  }
  try {
    const learning = await refreshLearning({ trigger: "manual", actor: { id: auth.profile.id, name: auth.profile.name } });
    return NextResponse.json({ learning });
  } catch (err) {
    console.error("[content-roteiros/aprendizado]", err);
    const msg = err instanceof Error ? err.message : "Erro ao atualizar o aprendizado.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
