"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getTitleTag } from "@/lib/planner-title-tag";
import { plannerTagDeliveryPath } from "@/lib/request-files/domain";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Quem posta informa na página de entregas que a peça foi publicada (conclui a
 * tarefa no planner, se ainda não estava) ou desfaz (só apaga a data; a etapa
 * fica como está, porque a peça pode ter sido concluída pela designer antes).
 */
export async function setDeliveryPiecePosted(input: {
  requestId: string;
  tag: string;
  postedOn: string | null;
}): Promise<{ error: string | null }> {
  if (input.postedOn !== null && !DATE_PATTERN.test(input.postedOn)) {
    return { error: "Informe uma data válida." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre de novo para continuar." };

  const { data: request } = await supabase
    .from("marketing_requests")
    .select("id, title, workflow_stage")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!request || getTitleTag(request.title as string)?.tag !== input.tag) {
    return { error: "Peça não encontrada nesta campanha." };
  }

  const prevStage = (request.workflow_stage as string | null) ?? "tarefas";
  const concludes = Boolean(input.postedOn) && prevStage !== "concluido";
  const nextStage = concludes ? "concluido" : null;
  const updates: Record<string, unknown> = {
    posted_at: input.postedOn ? `${input.postedOn}T12:00:00.000Z` : null,
    ...(concludes && { workflow_stage: "concluido", completion_type: "postagem_externa" }),
  };

  const { error } = await supabase.from("marketing_requests").update(updates).eq("id", request.id);
  if (error) return { error: "Não foi possível salvar. Tente de novo." };

  if (nextStage) {
    const { data: profile } = await supabase
      .from("users")
      .select("id, name")
      .eq("auth_id", user.id)
      .maybeSingle();
    await supabase.from("request_activity_log").insert({
      request_id: request.id,
      action: "stage_changed",
      from_value: prevStage,
      to_value: nextStage,
      user_id: profile?.id ?? null,
      user_name: profile?.name ?? null,
    });
  }

  revalidatePath(plannerTagDeliveryPath(input.tag));
  return { error: null };
}
