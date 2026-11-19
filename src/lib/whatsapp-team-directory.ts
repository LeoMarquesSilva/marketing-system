import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isLeaderPosition, normalizeBrazilPhone } from "@/lib/whatsapp-lead-forward-format";
import { citableArea, RECEPTION_CONTACT, type TeamContact } from "@/lib/whatsapp-team-contacts";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Equipe que pode ser citada ao cliente: pessoas ativas com perfil profissional
 * (o do site). Cargo e área vêm do RH; robôs ficam de fora. Liderança primeiro.
 */
export async function fetchTeamDirectory(): Promise<TeamContact[]> {
  const db = getAdminClient();
  const { data: profiles, error } = await db
    .from("professional_profiles")
    .select("user_id, professional_email, professional_phone, show_whatsapp, photo_url")
    .not("user_id", "is", null);
  if (error) throw new Error(error.message);

  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id as string, profile]));
  const userIds = [...profileByUser.keys()];
  if (userIds.length === 0) return [];

  const [{ data: users, error: usersError }, { data: employees }] = await Promise.all([
    db.from("users").select("id, name, avatar_url, department, is_active, ferias_view_enabled").in("id", userIds),
    db.from("hr_employees").select("user_id, position, department, is_active, is_automation").in("user_id", userIds),
  ]);
  if (usersError) throw new Error(usersError.message);
  const employeeByUser = new Map((employees ?? []).map((employee) => [employee.user_id as string, employee]));

  const team: TeamContact[] = [];
  for (const user of users ?? []) {
    const employee = employeeByUser.get(user.id as string);
    if (user.is_active === false || employee?.is_active === false || employee?.is_automation === true) continue;
    const profile = profileByUser.get(user.id as string)!;
    const email = (profile.professional_email as string | null)?.trim() || null;
    const cardPhone = profile.show_whatsapp ? normalizeBrazilPhone(profile.professional_phone as string | null) : null;
    if (!email && !cardPhone) continue;
    const position = (employee?.position as string | null | undefined) ?? null;
    team.push({
      id: user.id as string,
      name: (user.name as string | null)?.trim() || "Sem nome",
      avatarUrl: (user.avatar_url as string | null) ?? (profile.photo_url as string | null) ?? null,
      position,
      area: (employee?.department as string | null | undefined) ?? (user.department as string | null) ?? null,
      email,
      cardPhone,
      isLeader: isLeaderPosition(position) || user.ferias_view_enabled === true,
    });
  }
  return team.sort(
    (a, b) => Number(b.isLeader) - Number(a.isLeader) || a.name.localeCompare(b.name, "pt-BR")
  );
}

/**
 * A equipe no formato que a IA lê, com um código curto por pessoa (p1, p2…)
 * para as ações sugeridas. Devolve também o mapa código → id.
 */
export function formatTeamForPrompt(team: TeamContact[]): { text: string; idByRef: Map<string, string> } {
  const idByRef = new Map<string, string>();
  const lines = team.map((person, index) => {
    const ref = `p${index + 1}`;
    idByRef.set(ref, person.id);
    const details = [
      person.position,
      citableArea(person.area) ? `área ${citableArea(person.area)}` : null,
      person.email ? `e-mail ${person.email}` : "sem e-mail",
      person.cardPhone ? "tem cartão do WhatsApp" : null,
    ]
      .filter(Boolean)
      .join("; ");
    return `- [${ref}] ${person.name}: ${details}`;
  });
  return {
    text: `- [recepcao] ${RECEPTION_CONTACT.name}: WhatsApp da recepção; tem cartão do WhatsApp\n${lines.join("\n")}`,
    idByRef,
  };
}
