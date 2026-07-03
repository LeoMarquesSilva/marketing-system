/**
 * Gestão (admin) dos gestores de área jurídica — quem enxerga TODOS os
 * clientes de uma área em "Meus Clientes" (além do vínculo individual por
 * processo do SIOE). Usa service role, chamado a partir das API routes.
 */
import { getAdminClient } from "@/lib/email-marketing-server";

export interface AreaManagerEntry {
  area: string;
  userId: string;
  userName: string | null;
}

/** Áreas jurídicas conhecidas (SIOE processos_completo), para o seletor do admin. */
export async function listKnownAreas(): Promise<string[]> {
  const admin = getAdminClient();
  const [groups, companies, managers] = await Promise.all([
    admin.from("email_client_groups").select("legal_areas"),
    admin.from("email_companies").select("legal_areas"),
    admin.from("email_area_managers").select("area"),
  ]);
  const set = new Set<string>();
  for (const row of groups.data ?? []) {
    for (const area of (row.legal_areas as string[] | null) ?? []) set.add(area);
  }
  for (const row of companies.data ?? []) {
    for (const area of (row.legal_areas as string[] | null) ?? []) set.add(area);
  }
  for (const row of managers.data ?? []) {
    if (row.area) set.add(row.area as string);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function listAreaManagers(): Promise<AreaManagerEntry[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_area_managers")
    .select("area, user_id, users!email_area_managers_user_id_fkey(name)")
    .order("area", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const joined = (row as { users?: { name: string } | { name: string }[] | null }).users;
    const userName = Array.isArray(joined) ? (joined[0]?.name ?? null) : (joined?.name ?? null);
    return { area: row.area as string, userId: row.user_id as string, userName };
  });
}

export async function addAreaManager(
  area: string,
  userId: string,
  createdByUserId: string | null
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from("email_area_managers")
    .upsert(
      { area: area.trim(), user_id: userId, created_by: createdByUserId },
      { onConflict: "area,user_id" }
    );
  if (error) throw new Error(error.message);
}

export async function removeAreaManager(area: string, userId: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from("email_area_managers")
    .delete()
    .eq("area", area)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
