import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchInstagramThumbnailResponse } from "@/lib/instagram-thumbnail";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const igMediaId = decodeURIComponent(id).trim();
    if (!igMediaId) {
      return NextResponse.json({ error: "ID da mídia obrigatório." }, { status: 400 });
    }

    return await fetchInstagramThumbnailResponse(igMediaId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar capa.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
