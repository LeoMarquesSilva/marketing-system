import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createContentTopic, fetchContentTopics } from "@/lib/content-topics";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { topicInputSchema } from "@/lib/content-generator/topics";

export const dynamic = "force-dynamic";

/** Fontes de notícias. `?todas=1` inclui as pausadas (tela de Configurações). */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const includeInactive = new URL(request.url).searchParams.get("todas") === "1";
    const topics = await fetchContentTopics(includeInactive);
    return NextResponse.json(topics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar temas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Nova fonte (só a equipe de Marketing). */
export async function POST(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isContentManager(auth.profile)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const parsed = topicInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    const topic = await createContentTopic(parsed.data);
    return NextResponse.json(topic, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar a fonte.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
