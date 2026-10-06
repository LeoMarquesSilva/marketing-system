import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { canAccessPath, hasCafeCulturaAccess } from "@/lib/access-control";
import { getDietaryByUserIds } from "@/lib/rh/registration/server";
import type { DietaryInfo } from "@/lib/rh/registration/types";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function normalizeEmail(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

/**
 * Restrição alimentar dos convidados colaboradores (vinda da ficha cadastral
 * da RH), casando o e-mail do convite com o usuário. Só a restrição sai daqui.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    if (!serviceKey) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: profile } = await admin
      .from("users")
      .select("role, permissions")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    const access = {
      role: (profile?.role as string | null) ?? null,
      permissions: (profile?.permissions as string[] | null) ?? null,
    };
    if (!canAccessPath(access, "/eventos") && !hasCafeCulturaAccess(access)) {
      return NextResponse.json({ error: "Sem acesso a Eventos." }, { status: 403 });
    }

    const { id } = await params;
    const { data: invites, error } = await admin
      .from("event_invites")
      .select("id, email")
      .eq("event_id", id)
      .eq("guest_type", "colaborador");
    if (error) return NextResponse.json({ error: "Não foi possível carregar os convidados." }, { status: 500 });

    const emails = [...new Set((invites ?? []).map((row) => normalizeEmail(row.email)).filter(Boolean))] as string[];
    const byInviteId: Record<string, DietaryInfo> = {};
    if (emails.length === 0) return NextResponse.json({ byInviteId });

    const { data: users } = await admin.from("users").select("id, email").not("email", "is", null);
    const userByEmail = new Map<string, string>();
    for (const user of users ?? []) {
      const email = normalizeEmail(user.email);
      if (email && emails.includes(email)) userByEmail.set(email, user.id as string);
    }

    const dietary = await getDietaryByUserIds(admin, [...userByEmail.values()]);
    for (const invite of invites ?? []) {
      const email = normalizeEmail(invite.email);
      const userId = email ? userByEmail.get(email) : undefined;
      const info = userId ? dietary.get(userId) : undefined;
      if (info) byInviteId[invite.id as string] = info;
    }
    return NextResponse.json({ byInviteId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /não autenticado|inativo/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? message : "Erro ao carregar restrições." }, { status });
  }
}
