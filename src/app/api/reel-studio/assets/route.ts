import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { REEL_STUDIO_ASSETS_PROMPT, reelStudioAssetsSchema } from "@/lib/reel-studio";
import { getServerDb } from "@/lib/users-server";

const inputSchema = z.object({ id: z.string().uuid() });

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!auth.profile) return NextResponse.json({ error: "Perfil de conteúdo não encontrado." }, { status: 403 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Roteiro inválido." }, { status: 400 });

  const db = await getServerDb();
  const { data: item, error: itemError } = await db
    .from("reel_studio_items")
    .select("id, title, area, original_script, refined_script")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: "Roteiro não encontrado." }, { status: 404 });

  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A chave de IA não está configurada." }, { status: 500 });

  try {
    const script = item.refined_script || item.original_script;
    const result = await generateObject({
      model: createOpenAI({ apiKey })(process.env.OPENAI_REELS_MODEL ?? "gpt-5.6-terra"),
      schema: reelStudioAssetsSchema,
      schemaName: "ativos_publicacao_reel",
      system: REEL_STUDIO_ASSETS_PROMPT,
      prompt: `Tema: ${item.title}\nÁrea: ${item.area ?? "Não informada"}\n\nRoteiro:\n${script}`,
    });

    const { error: updateError } = await db
      .from("reel_studio_items")
      .update({ caption: result.object.legenda, cover_prompt: result.object.prompt_capa })
      .eq("id", item.id);
    if (updateError) throw updateError;

    return NextResponse.json({ assets: result.object });
  } catch (error) {
    console.error("[reel-studio/assets] falha", error);
    return NextResponse.json({ error: "Não foi possível gerar os ativos agora." }, { status: 500 });
  }
}
