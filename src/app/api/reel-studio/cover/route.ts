import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { getServerDb } from "@/lib/users-server";
import { PROJECT_ASSETS_BUCKET, publicStorageObjectUrl } from "@/lib/storage-buckets";

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
    .select("id, title, area, cover_prompt")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: "Roteiro não encontrado." }, { status: 404 });
  if (!item.cover_prompt) {
    return NextResponse.json({ error: "Gere a legenda e a direção visual antes de criar a capa." }, { status: 400 });
  }

  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A chave de IA não está configurada." }, { status: 500 });

  try {
    const prompt = `Crie uma imagem editorial para capa de Reel jurídico em formato vertical 2:3. Tema: ${item.title}. Área: ${item.area ?? "Jurídico"}. ${item.cover_prompt} Não inclua palavras, letras, números, logotipos, marcas d'água ou selos.`;
    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_REEL_IMAGE_MODEL ?? "gpt-image-2",
        prompt,
        size: "1024x1536",
        quality: "medium",
      }),
    });
    const imageData = (await imageResponse.json().catch(() => null)) as {
      data?: Array<{ b64_json?: string }>;
      error?: { message?: string };
    } | null;
    const base64 = imageData?.data?.[0]?.b64_json;
    if (!imageResponse.ok || !base64) {
      throw new Error(imageData?.error?.message ?? "A imagem não foi retornada pela IA.");
    }

    const path = `reels/covers/${item.id}/${Date.now()}-capa.png`;
    const { error: uploadError } = await db.storage
      .from(PROJECT_ASSETS_BUCKET)
      .upload(path, Buffer.from(base64, "base64"), { contentType: "image/png", upsert: true });
    if (uploadError) throw uploadError;

    const coverUrl = publicStorageObjectUrl(PROJECT_ASSETS_BUCKET, path);
    if (!coverUrl) throw new Error("Não foi possível salvar a URL pública da capa.");
    const { error: updateError } = await db
      .from("reel_studio_items")
      .update({ cover_image_url: coverUrl })
      .eq("id", item.id);
    if (updateError) throw updateError;

    return NextResponse.json({ cover_image_url: coverUrl });
  } catch (error) {
    console.error("[reel-studio/cover] falha", error);
    return NextResponse.json({ error: "Não foi possível gerar a capa agora." }, { status: 500 });
  }
}
