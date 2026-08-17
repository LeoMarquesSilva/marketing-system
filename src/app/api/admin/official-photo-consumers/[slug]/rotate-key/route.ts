import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const authUser = await requireAuthenticatedUser();
    await requireAdminUser(authUser.id);

    const { slug } = await context.params;
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
      return NextResponse.json({ error: "Consumidor inválido." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("Service role não configurada.");
    const db = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const apiKey = `ofp_${slug}_${randomBytes(32).toString("base64url")}`;
    const keyPrefix = apiKey.slice(0, 16);
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const rotatedAt = new Date().toISOString();
    const { data, error } = await db
      .from("official_photo_api_consumers")
      .update({
        key_prefix: keyPrefix,
        key_hash: keyHash,
        key_rotated_at: rotatedAt,
        updated_at: rotatedAt,
      })
      .eq("slug", slug)
      .select("id, slug, name, key_rotated_at")
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Consumidor não encontrado." }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({
      consumer: data,
      apiKey,
      warning: "Esta chave será exibida somente nesta resposta.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao rotacionar chave.";
    const status =
      message === "Não autenticado."
        ? 401
        : message.includes("administradores") || message === "Usuário inativo."
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
