import { createHash } from "node:crypto";
import { getAdminClient } from "./email-marketing-server";
import { fetchMeusClientesPayload } from "./meus-clientes-server";
import { clientGuestCandidates, uniqueGuestCandidates, type GuestCandidate, type GuestImportSource } from "./event-guest-import";

export function guestImportId(eventId: string, key: string): string {
  const hash = createHash("sha256").update(`event-guest:${eventId}:${key}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function fetchGuestCandidates(source: GuestImportSource, authUserId: string): Promise<GuestCandidate[]> {
  if (source === "clients") {
    // Uses the same scope rules as Meus Clientes. viewAll only applies to admins.
    const payload = await fetchMeusClientesPayload({ authUserId, viewAll: true });
    return clientGuestCandidates(payload.people, payload.contacts);
  }
  const db = getAdminClient();
  const { data: employees, error } = await db.from("hr_employees")
    .select("id, user_id, full_name, email, department")
    .eq("is_active", true).order("full_name");
  if (error) throw new Error("Não foi possível carregar os colaboradores do escritório.");
  const userIds = (employees ?? []).flatMap(row => row.user_id ? [row.user_id as string] : []);
  const avatars = new Map<string, string | null>();
  if (userIds.length) {
    const { data, error: avatarError } = await db.from("users").select("id, avatar_url").in("id", userIds);
    if (avatarError) throw new Error("Não foi possível carregar as fotos dos colaboradores.");
    for (const row of data ?? []) avatars.set(row.id, row.avatar_url);
  }
  return uniqueGuestCandidates((employees ?? []).map(row => ({
    key: `employee:${row.id}`, name: row.full_name, email: row.email,
    phone: null, company: null, guestType: "colaborador" as const,
    avatarUrl: avatars.get(row.user_id) ?? null, detail: row.department,
  })));
}
