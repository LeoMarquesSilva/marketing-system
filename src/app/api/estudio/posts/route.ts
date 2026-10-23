import { NextResponse } from "next/server";
import { listStudioPosts } from "@/lib/estudio/posts-server";
import { requireStudioUser } from "@/lib/estudio/server";

export const dynamic = "force-dynamic";

/** Posts aprovados do Gerador de conteúdo, para montar o carrossel no Estúdio. */
export async function GET() {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ posts: await listStudioPosts() });
  } catch (error) {
    console.error("[estudio/posts] lista", error);
    return NextResponse.json({ error: "Não foi possível carregar os posts do Gerador." }, { status: 500 });
  }
}
