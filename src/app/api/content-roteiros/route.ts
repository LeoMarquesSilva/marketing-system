import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/users-server";
import { canSeeContentRoteiro } from "@/lib/content-areas";
import { autoLinkContentSchedule } from "@/lib/content-schedule/server";
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
    const contentId = searchParams.get("contentId");
    if (contentId) {
      const db = await getServerDb();
      const { data: item, error } = await db.from("content_roteiros").select("*").eq("id", contentId).maybeSingle();
      if (error) throw new Error("Não foi possível consultar o conteúdo.");
      if (!item) return NextResponse.json([], { status: 200 });
      if (!canSeeContentRoteiro(auth.profile, { area: item.area, createdById: item.created_by_id })) return NextResponse.json({ error: "Sem permissão para este conteúdo." }, { status: 403 });
      return NextResponse.json([item]);
    }
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
      has_alterations,
      alterations_notes,
      sent_for_manager_review,
      post,
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

    if (!auth.profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
    const db = await getServerDb();
    const [{ data: current, error: currentError }, { data: activeProfile }] = await Promise.all([
      db.from("content_roteiros").select("id, area, created_by_id, approved_by_id, approved_by_name, approved_at, status").eq("id", id).maybeSingle(),
      db.from("users").select("is_active").eq("id", auth.profile.id).maybeSingle(),
    ]);
    if (currentError) throw new Error("Não foi possível consultar o conteúdo.");
    if (!current) return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
    if (!activeProfile || activeProfile.is_active === false || !canSeeContentRoteiro(auth.profile, { area: current.area, createdById: current.created_by_id })) {
      return NextResponse.json({ error: "Sem permissão para este conteúdo." }, { status: 403 });
    }

    // Confirmação de edição do colaborador ("ficar com este texto").
    if (action === "edit") {
      if (typeof post !== "string" || !post.trim()) {
        return NextResponse.json({ error: "post é obrigatório." }, { status: 400 });
      }
      const { has_alterations: altered } = await saveRoteiroEdit(id, post, {
        id: auth.profile.id,
        name: auth.profile.name,
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

    const approverId = current.approved_by_id ?? auth.profile.id;
    const approverName = current.approved_by_name ?? auth.profile.name;

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

    const persistedApproval = await updateRoteiroStatus(
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
    if (status === "em_revisao" || status === "aprovado") {
      if (!persistedApproval) throw new Error("Não foi possível confirmar a aprovação.");
      await autoLinkContentSchedule({
        collaboratorId: persistedApproval.approved_by_id,
        area: current.area,
        format: "post",
        contentRoteiroId: current.id,
        eventDate: persistedApproval.approved_at,
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar conteúdo de post.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
