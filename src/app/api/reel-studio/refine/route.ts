import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import {
  REEL_STUDIO_REFINEMENT_PROMPT,
  reelStudioRefinementSchema,
} from "@/lib/reel-studio";
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
    .select("id, title, area, original_script")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: "Roteiro não encontrado." }, { status: 404 });

  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A chave de IA não está configurada." }, { status: 500 });

  try {
    const result = await generateObject({
      model: createOpenAI({ apiKey })(process.env.OPENAI_REELS_MODEL ?? "gpt-5.6-terra"),
      schema: reelStudioRefinementSchema,
      schemaName: "roteiro_teleprompter_revisado",
      system: REEL_STUDIO_REFINEMENT_PROMPT,
      prompt: `Tema: ${item.title}\nÁrea: ${item.area ?? "Não informada"}\n\nRoteiro recebido:\n${item.original_script}`,
    });

    const { error: updateError } = await db
      .from("reel_studio_items")
      .update({ refined_script: result.object.roteiro_refinado, status: "reviewed" })
      .eq("id", item.id);
    if (updateError) throw updateError;

    return NextResponse.json({ refinement: result.object });
  } catch (error) {
    console.error("[reel-studio/refine] falha", error);
    return NextResponse.json({ error: "Não foi possível refinar o roteiro agora." }, { status: 500 });
  }
}
