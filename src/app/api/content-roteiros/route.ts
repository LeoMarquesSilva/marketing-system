import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchContentRoteiros, updateRoteiroStatus } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const topic_id = searchParams.get("topic_id") ?? undefined;
    const area = searchParams.get("area") ?? undefined;

    const roteiros = await fetchContentRoteiros({ status, topic_id, area });
    return NextResponse.json(roteiros);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar roteiros.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      id,
      status,
      approved_by_id,
      approved_by_name,
      has_alterations,
      alterations_notes,
      sent_for_manager_review,
      post,
    } = body as {
      id?: string;
      status?: string;
      approved_by_id?: string;
      approved_by_name?: string;
      has_alterations?: boolean;
      alterations_notes?: string | null;
      sent_for_manager_review?: boolean;
      post?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }
    if (
      !status ||
      !["aguardando_aprovacao", "aprovado", "rejeitado"].includes(status)
    ) {
      return NextResponse.json(
        { error: "status deve ser aguardando_aprovacao, aprovado ou rejeitado." },
        { status: 400 }
      );
    }

    if (status === "aprovado" && (!approved_by_id || !approved_by_name)) {
      return NextResponse.json(
        { error: "approved_by_id e approved_by_name são obrigatórios ao aprovar." },
        { status: 400 }
      );
    }

    const approvalData =
      status === "aprovado"
        ? {
            approved_by_id: approved_by_id!,
            approved_by_name: approved_by_name!,
            has_alterations: has_alterations ?? false,
            alterations_notes: alterations_notes ?? null,
            sent_for_manager_review: sent_for_manager_review ?? false,
            post,
          }
        : undefined;

    await updateRoteiroStatus(
      id,
      status as "aguardando_aprovacao" | "aprovado" | "rejeitado",
      approvalData
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar conteúdo de post.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
