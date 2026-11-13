import "server-only";

import { getServerDb } from "@/lib/users-server";
import { urlDoLogoDoGrupo } from "@/lib/icp/server";
import { PhotoHttpError, isEventPhotosManager, type resolveAppUser } from "@/lib/event-photos/server";

type Actor = Awaited<ReturnType<typeof resolveAppUser>>;

/**
 * Logos do cadastro de clientes (ICP) para a plaquinha da página do convidado.
 * Arquivo à parte para a página pública não carregar o módulo do ICP.
 */
export async function searchShareLogos(
  actor: Actor,
  query: string
): Promise<Array<{ name: string; logoUrl: string }>> {
  if (!isEventPhotosManager(actor)) {
    throw new PhotoHttpError(403, "Só o marketing compartilha álbuns de eventos.");
  }
  const term = query.replace(/[%_,()*\\.]/g, " ").replace(/\s+/g, " ").trim();
  if (term.length < 2) return [];
  const db = await getServerDb();
  const { data, error } = await db
    .from("icp_group_profiles")
    .select("grupo, linkedin_name, logo_path, updated_at")
    .not("logo_path", "is", null)
    .or(`grupo.ilike.%${term}%,linkedin_name.ilike.%${term}%`)
    .order("grupo")
    .limit(6);
  if (error) throw new PhotoHttpError(500, error.message);
  return (data ?? []).map((row) => ({
    name: (row.linkedin_name as string | null) || (row.grupo as string),
    logoUrl: urlDoLogoDoGrupo(row.logo_path as string, row.updated_at as string),
  }));
}
