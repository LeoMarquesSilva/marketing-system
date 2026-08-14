import { getServerDb } from "@/lib/users-server";
import type { PhotoRosterPerson } from "@/lib/collaborator-photos/roster";

/**
 * Lista de colaboradores para Fotos — mesma fonte de Férias (`hr_employees`),
 * sincronizada com o VIOS. Exclui isentos de férias (sócios etc.), como em Férias.
 */
export async function fetchPhotoRosterServer(): Promise<PhotoRosterPerson[]> {
  const db = await getServerDb();

  const { data: employees, error } = await db
    .from("hr_employees")
    .select("id, user_id, full_name, email, department, position, is_active")
    .eq("vacation_exempt", false)
    .order("full_name");

  if (error) {
    console.error("Erro ao buscar roster de fotos (hr_employees):", error);
    return [];
  }

  const rows = employees ?? [];
  const userIds = rows
    .map((row) => row.user_id as string | null)
    .filter((id): id is string => Boolean(id));

  const avatarByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await db
      .from("users")
      .select("id, avatar_url")
      .in("id", userIds);
    if (usersError) {
      console.error("Erro ao buscar avatares do roster de fotos:", usersError);
    } else {
      for (const user of users ?? []) {
        avatarByUser.set(user.id as string, (user.avatar_url as string | null) ?? null);
      }
    }
  }

  return rows.map((row) => {
    const userId = (row.user_id as string | null) ?? null;
    return {
      employeeId: row.id as string,
      userId,
      name: row.full_name as string,
      email: (row.email as string | null) ?? null,
      department: (row.department as string | null) ?? null,
      position: (row.position as string | null) ?? null,
      isActive: Boolean(row.is_active),
      avatarUrl: userId ? avatarByUser.get(userId) ?? null : null,
    };
  });
}
