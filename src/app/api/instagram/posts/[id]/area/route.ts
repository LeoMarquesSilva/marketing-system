import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { updatePostAssignments } from "@/lib/instagram-posts";
import { autoLinkInstagramPublicationToSchedule } from "@/lib/content-schedule/server";

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
    let scheduleLink = null;
    try {
      scheduleLink = await autoLinkInstagramPublicationToSchedule(id);
    } catch (scheduleError) {
      console.error("[instagram-post-area] área salva; falha ao atualizar cronograma", scheduleError);
    }
    return NextResponse.json({ success: true, scheduleLink });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar área.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
