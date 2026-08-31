/**
 * Gestão (admin) dos gestores de área jurídica — quem enxerga TODOS os
 * clientes de uma área em "Meus Clientes" (além do vínculo individual por
 * processo do SIOE). Usa service role, chamado a partir das API routes.
 */
import { getAdminClient } from "@/lib/email-marketing-server";
import { mergeAreaManagerPickerAreas, normalizeLegalAreas } from "@/lib/legal-areas";

export interface AreaManagerEntry {
  area: string;
  userId: string;
  userName: string | null;
}

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
  return mergeAreaManagerPickerAreas(Array.from(set));
}

export async function listAreaManagerAreasForUser(userId: string): Promise<string[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_area_managers")
    .select("area")
    .eq("user_id", userId)
    .order("area", { ascending: true });
  if (error) throw new Error(error.message);
  return normalizeLegalAreas((data ?? []).map((row) => row.area as string));
}

export async function replaceAreaManagersForUser(options: {
  userId: string;
  areas: string[];
  createdByUserId: string | null;
}): Promise<string[]> {
  const admin = getAdminClient();
  const { data: user, error: userError } = await admin
    .from("users")
    .select("is_active")
    .eq("id", options.userId)
    .maybeSingle();
  if (userError) throw new Error(userError.message);

  const nextAreas = normalizeLegalAreas(options.areas);
  if (nextAreas.length > 0 && (!user || user.is_active === false)) {
    throw new Error("Não é possível cadastrar um usuário inativo como gestor de área.");
  }
  const { error: deleteError } = await admin
    .from("email_area_managers")
    .delete()
    .eq("user_id", options.userId);
  if (deleteError) throw new Error(deleteError.message);

  if (nextAreas.length > 0) {
    const { error: insertError } = await admin.from("email_area_managers").insert(
      nextAreas.map((area) => ({
        area,
        user_id: options.userId,
        created_by: options.createdByUserId,
      }))
    );
    if (insertError) throw new Error(insertError.message);
  }

  return nextAreas;
}

export async function listAreaManagers(): Promise<AreaManagerEntry[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_area_managers")
    .select("area, user_id, users!email_area_managers_user_id_fkey(name, is_active)")
    .order("area", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const joined = (
      row as {
        users?: { name: string; is_active: boolean | null } | { name: string; is_active: boolean | null }[] | null;
      }
    ).users;
    const user = Array.isArray(joined) ? joined[0] : joined;
    if (!user || user.is_active === false) return [];
    return [{ area: row.area as string, userId: row.user_id as string, userName: user.name ?? null }];
  });
}

export async function addAreaManager(
  area: string,
  userId: string,
  createdByUserId: string | null
): Promise<void> {
  const admin = getAdminClient();
  const { data: user, error: userError } = await admin
    .from("users")
    .select("is_active")
    .eq("id", userId)
    .maybeSingle();
  if (userError) throw new Error(userError.message);
  if (!user || user.is_active === false) {
    throw new Error("Não é possível cadastrar um usuário inativo como gestor de área.");
  }

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
