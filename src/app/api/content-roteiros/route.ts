import { NextResponse } from "next/server";
import {
  getAuthenticatedContentUser,
  resolveAreaFilter,
} from "@/lib/content-access";
import {
  fetchContentRoteiros,
  updateRoteiroStatus,
  saveRoteiroEdit,
  sendRoteiroToMarketing,
  linkRoteiroViosTask,
  updateRoteiroBoletimScore,
} from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedContentUser();
    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const topic_id = searchParams.get("topic_id") ?? undefined;
    const area = searchParams.get("area") ?? undefined;

    const access = resolveAreaFilter(auth.profile, area);
    if (access.denied) {
      return NextResponse.json({ error: "Sem permissão para esta área." }, { status: 403 });
    }

    const roteiros = await fetchContentRoteiros({
      status,
      topic_id,
      area: access.area,
      areas: access.areas ?? undefined,
      createdById: access.includeCreatedById,
    });
    return NextResponse.json(roteiros);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar roteiros.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedContentUser();
    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      id,
      action,
      status,
      approved_by_id,
      approved_by_name,
      has_alterations,
      alterations_notes,
      sent_for_manager_review,
      post,
      edited_by_id,
      edited_by_name,
    } = body as {
      id?: string;
      action?: string;
      status?: string;
      approved_by_id?: string;
      approved_by_name?: string;
      has_alterations?: boolean;
      alterations_notes?: string | null;
      sent_for_manager_review?: boolean;
      post?: string;
      edited_by_id?: string;
      edited_by_name?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    // Confirmação de edição do colaborador ("ficar com este texto").
    if (action === "edit") {
      if (typeof post !== "string" || !post.trim()) {
        return NextResponse.json({ error: "post é obrigatório." }, { status: 400 });
      }
      const { has_alterations: altered } = await saveRoteiroEdit(id, post, {
        id: edited_by_id ?? auth.profile?.id ?? null,
        name: edited_by_name ?? auth.profile?.name ?? null,
      });
      return NextResponse.json({ success: true, has_alterations: altered });
    }

    // Vincular/desvincular tarefa do VIOS.
    if (action === "link_vios") {
      const viosTaskId = (body as { vios_task_id?: string | null }).vios_task_id ?? null;
      await linkRoteiroViosTask(id, viosTaskId);
      return NextResponse.json({ success: true });
    }

    // Nota de relevância para o boletim (1–5) ou null para limpar.
    if (action === "boletim_score") {
      const scoreRaw = (body as { score?: number | null }).score;
      const score =
        scoreRaw === null || scoreRaw === undefined ? null : Number(scoreRaw);
      if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
        return NextResponse.json(
          { error: "Informe uma nota de 1 a 5, ou null para limpar." },
          { status: 400 }
        );
      }
      const result = await updateRoteiroBoletimScore(id, score, {
        name: auth.profile?.name ?? null,
      });
      return NextResponse.json({ success: true, ...result });
    }

    // Envio ao marketing: cria card no Planner.
    if (action === "send_mkt") {
      const origin =
        request.headers.get("origin") ??
        (request.headers.get("host") ? `https://${request.headers.get("host")}` : undefined);
      const result = await sendRoteiroToMarketing(
        id,
        { id: auth.profile?.id ?? null, name: auth.profile?.name ?? null },
        origin
      );
      return NextResponse.json({ success: true, ...result });
    }

    const allowedStatuses = [
      "aguardando_aprovacao",
      "em_revisao",
      "aprovado_revisor",
      "aprovado",
      "rejeitado",
    ];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status inválido.` },
        { status: 400 }
      );
    }

    if (status === "aprovado" && (!approved_by_id || !approved_by_name)) {
      return NextResponse.json(
        { error: "approved_by_id e approved_by_name são obrigatórios ao aprovar." },
        { status: 400 }
      );
    }

    const approverId = approved_by_id ?? auth.profile?.id ?? "";
    const approverName = approved_by_name ?? auth.profile?.name ?? "";

    const approvalData =
      status === "aprovado" || status === "em_revisao"
        ? {
            approved_by_id: approverId,
            approved_by_name: approverName,
            has_alterations: has_alterations ?? false,
            alterations_notes: alterations_notes ?? null,
            sent_for_manager_review: sent_for_manager_review ?? false,
            post,
          }
        : undefined;

    // Edição avulsa do texto: quando vier um novo post fora do fluxo de aprovação.
    const postOverride =
      status !== "aprovado" && status !== "em_revisao" && typeof post === "string"
        ? post
        : undefined;

    await updateRoteiroStatus(
      id,
      status as
        | "aguardando_aprovacao"
        | "em_revisao"
        | "aprovado_revisor"
        | "aprovado"
        | "rejeitado",
      approvalData,
      postOverride
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar conteúdo de post.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
