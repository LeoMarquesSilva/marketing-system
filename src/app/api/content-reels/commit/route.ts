import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContentUser, resolveAreaFilter } from "@/lib/content-access";
import { getServerDb } from "@/lib/users-server";
import { canSeeContentRoteiro } from "@/lib/content-areas";
import { autoLinkContentSchedule } from "@/lib/content-schedule/server";

const inputSchema = z.object({
  generation_key: z.string().uuid(),
  source_content_id: z.string().uuid().nullable(),
  title: z.string().trim().min(4).max(240),
  area: z.string().trim().min(2).max(120),
  script: z.string().trim().min(80).max(24000),
});

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedContentUser();
    if (!auth) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!auth.profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Revise o roteiro antes de usar." }, { status: 400 });
    const input = parsed.data;
    const db = await getServerDb();
    const { data: active } = await db.from("users").select("is_active").eq("id", auth.profile.id).maybeSingle();
    const scope = resolveAreaFilter(auth.profile, input.area);
    if (!active || active.is_active === false || scope.denied || scope.areas?.length === 0) {
      return NextResponse.json({ error: "Sem permissão para esta área." }, { status: 403 });
    }
    if (input.source_content_id) {
      const { data: source, error } = await db.from("content_roteiros").select("area, created_by_id").eq("id", input.source_content_id).maybeSingle();
      if (error) throw new Error("Não foi possível consultar a notícia de origem.");
      if (!source || !canSeeContentRoteiro(auth.profile, { area: source.area, createdById: source.created_by_id })) {
        return NextResponse.json({ error: "Notícia de origem indisponível." }, { status: 403 });
      }
    }

    // A chave pertence a uma versão gerada. Repetir uma confirmação recupera a mesma produção.
    const { error: insertError } = await db.from("reel_studio_items").upsert({
      generation_key: input.generation_key,
      source_content_id: input.source_content_id,
      production_month: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).slice(0, 7) + "-01",
      title: input.title,
      area: input.area,
      original_script: input.script,
      created_by_id: auth.profile.id,
      created_by_name: auth.profile.name,
    }, { onConflict: "generation_key", ignoreDuplicates: true });
    if (insertError) throw new Error("Não foi possível salvar o roteiro no estúdio.");
    const { data: item, error: itemError } = await db.from("reel_studio_items").select("id, area, created_by_id, created_at, source_content_id").eq("generation_key", input.generation_key).single();
    if (itemError || !item) throw new Error("Não foi possível recuperar o roteiro salvo.");
    if (item.created_by_id !== auth.profile.id) return NextResponse.json({ error: "Roteiro de outro colaborador." }, { status: 403 });
    const { error: assigneeError } = await db.from("reel_studio_assignees").upsert({ reel_id: item.id, user_id: auth.profile.id, user_name: auth.profile.name }, { onConflict: "reel_id,user_id", ignoreDuplicates: true });
    if (assigneeError) throw new Error("Roteiro salvo. Tente novamente para concluir a atribuição.");
    const link = await autoLinkContentSchedule({ collaboratorId: auth.profile.id, area: item.area, format: "reel", contentRoteiroId: item.source_content_id ?? undefined, reelStudioId: item.id, eventDate: item.created_at });
    return NextResponse.json({ itemId: item.id, link, message: "Roteiro salvo no estúdio. A associação ao cronograma foi processada; eventuais pendências ficam com o Marketing." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível usar o roteiro." }, { status: 500 });
  }
}
