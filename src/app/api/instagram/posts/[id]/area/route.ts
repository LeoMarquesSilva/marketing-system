import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { updatePostAssignments } from "@/lib/instagram-posts";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await updatePostAssignments(id, {
      area: (body.area as string | null | undefined)?.trim() || null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar área.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
