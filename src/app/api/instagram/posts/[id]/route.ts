import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { updatePostAssignments } from "@/lib/instagram-posts";
import type { PostSolicitante } from "@/lib/instagram-posts";

export const dynamic = "force-dynamic";

function parseSolicitantes(raw: unknown): PostSolicitante[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const { id, name } = item as { id?: string; name?: string };
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((s): s is PostSolicitante => s !== null);
}

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

    const assignments: {
      area?: string | null;
      areas?: string[] | null;
      solicitante_id?: string | null;
      solicitante?: string | null;
      solicitantes?: PostSolicitante[] | null;
      skip_participants?: boolean;
    } = {};

    if ("areas" in body) {
      assignments.areas = Array.isArray(body.areas)
        ? (body.areas as string[]).map((a) => a.trim()).filter(Boolean)
        : [];
    }
    if ("solicitantes" in body) {
      assignments.solicitantes = parseSolicitantes(body.solicitantes) ?? [];
    }
    if ("skip_participants" in body) {
      assignments.skip_participants = Boolean(body.skip_participants);
    }

    if ("area" in body) {
      assignments.area = (body.area as string | null | undefined)?.trim() || null;
    }
    if ("solicitante_id" in body) {
      assignments.solicitante_id = (body.solicitante_id as string | null | undefined) || null;
    }
    if ("solicitante" in body) {
      assignments.solicitante = (body.solicitante as string | null | undefined)?.trim() || null;
    }

    await updatePostAssignments(id, assignments);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar post.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
