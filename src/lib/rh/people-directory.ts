import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { RhHttpError } from "@/lib/rh/qualifications/server";

/** Colaborador do cadastro do RH com foto e nome curto (Boas práticas, BP Awards). */
export interface DirectoryPerson {
  id: string;
  full_name: string;
  /** Nome de exibição: o do organograma, senão primeiro + último nome. */
  short_name: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  /** Foto do usuário (avatar → OneDrive) ou, na falta, a do organograma. */
  avatar_url: string | null;
  user_id: string | null;
}

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

function nameParts(name: string): string[] {
  return name.trim().split(/\s+/).filter((part) => !NAME_PARTICLES.has(part.toLowerCase()));
}

/** "Caio Augusto de Alcântara César Silva" → "Caio Silva". */
function firstAndLastName(fullName: string): string {
  const parts = nameParts(fullName);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName.trim();
}

/** Nome do organograma quando é curto; "Renato Rossetti Vallim de Castro" → "Renato Rossetti". */
function displayName(orgName: string | undefined, fullName: string): string {
  if (!orgName?.trim()) return firstAndLastName(fullName);
  const parts = nameParts(orgName);
  return parts.length > 3 ? `${parts[0]} ${parts[1]}` : orgName.trim();
}

type EmployeeRow = Omit<DirectoryPerson, "short_name" | "avatar_url"> & { is_automation?: boolean | null };

/** Cadastro inteiro (ativos e ex-colaboradores), com foto e nome curto. `tag` identifica o log. */
export async function loadPeopleDirectory(db: SupabaseClient, tag: string): Promise<DirectoryPerson[]> {
  const [employeesResult, orgResult] = await Promise.all([
    db.from("hr_employees").select("id, full_name, department, position, is_active, user_id, is_automation").order("full_name"),
    db.from("org_chart_members").select("employee_id, display_name, photo_url, placement"),
  ]);
  if (employeesResult.error) {
    console.error(`[${tag}] colaboradores:`, employeesResult.error);
    throw new RhHttpError("Falha ao carregar colaboradores.", 500, "QUERY_FAILED");
  }
  if (orgResult.error) console.error(`[${tag}] organograma:`, orgResult.error);

  // Conta de automação (robô do VIOS) não é pessoa da equipe.
  const employees = ((employeesResult.data ?? []) as EmployeeRow[])
    .filter((person) => !person.is_automation)
    .map((person) => ({
      id: person.id,
      full_name: person.full_name,
      department: person.department,
      position: person.position,
      is_active: person.is_active,
      user_id: person.user_id,
    }));
  const userIds = [...new Set(employees.map((person) => person.user_id).filter(Boolean))] as string[];
  const avatarByUser = new Map<string, string>();
  if (userIds.length) {
    const { data, error } = await db.from("users").select("id, avatar_url, photo_onedrive_url").in("id", userIds);
    if (error) console.error(`[${tag}] fotos:`, error);
    for (const user of data ?? []) {
      const url = resolveEmployeeAvatarUrl(user.avatar_url as string | null, user.photo_onedrive_url as string | null);
      if (url) avatarByUser.set(user.id as string, url);
    }
  }
  const orgByEmployee = new Map<string, { display_name: string; photo_url: string | null }>();
  for (const member of orgResult.data ?? []) {
    if (member.placement === "hidden") continue;
    const current = orgByEmployee.get(member.employee_id as string);
    if (!current || (!current.photo_url && member.photo_url)) {
      orgByEmployee.set(member.employee_id as string, {
        display_name: member.display_name as string,
        photo_url: (member.photo_url as string | null) ?? null,
      });
    }
  }

  return employees.map((person) => {
    const org = orgByEmployee.get(person.id);
    return {
      ...person,
      short_name: displayName(org?.display_name, person.full_name),
      avatar_url: (person.user_id ? avatarByUser.get(person.user_id) : undefined) ?? org?.photo_url ?? null,
    };
  });
}
