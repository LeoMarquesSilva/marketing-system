import { createClient } from "@/utils/supabase/server";
import { fetchMarketingRequests, type UserRole } from "./marketing-requests";

/**
 * Busca solicitações com filtro por role do usuário autenticado.
 * Usa o Supabase server client para obter a sessão.
 * admin: todas | designer: assignee_id = user OU workflow em revisao/revisado/revisao_autor | solicitante: solicitante_id = user
 */
export async function fetchMarketingRequestsForAuth() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return fetchMarketingRequests();
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, role, department")
      .eq("auth_id", authUser.id)
      .single();

    const userId = profile?.id;
    const r = (profile?.role as string | null | undefined)?.toLowerCase?.();
    const dept = profile?.department?.trim?.();
    const role: UserRole =
      r === "admin"
        ? "admin"
        : r === "solicitante"
          ? "solicitante"
          : r === "designer" || dept === "Marketing"
            ? "designer"
            : "admin";

    // Designer: precisa de userId para filtrar (suas tarefas + pipeline de revisão)
    if (role === "designer" && !userId) {
      return [];
    }

    return fetchMarketingRequests({
      userId,
      role,
      supabaseClient: supabase,
    });
  } catch {
    return fetchMarketingRequests();
  }
}
