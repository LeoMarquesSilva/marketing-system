import { NextResponse } from "next/server";
import { createClient as createPublicClient } from "@/utils/supabase/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  addAreaManager,
  listAreaManagers,
  listKnownAreas,
  removeAreaManager,
} from "@/lib/email-area-managers-server";

export const dynamic = "force-dynamic";

async function resolveCurrentUserId(): Promise<string | null> {
  const supabase = await createPublicClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Lista áreas conhecidas + gestores já vinculados a cada uma. */
export async function GET() {
  try {
    await requireAuthenticatedUser();
    const [areas, managers] = await Promise.all([listKnownAreas(), listAreaManagers()]);
    return NextResponse.json({ areas, managers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar gestores de área.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Vincula um usuário como gestor de uma área (vê todos os clientes daquela área). */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const area = String(body.area ?? "").trim();
    const userId = String(body.userId ?? "").trim();
    if (!area || !userId) {
      return NextResponse.json({ error: "Informe a área e o usuário." }, { status: 400 });
    }
    const createdBy = await resolveCurrentUserId();
    await addAreaManager(area, userId, createdBy);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao vincular gestor de área.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Remove o vínculo de um usuário como gestor de uma área. */
export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const area = String(body.area ?? "").trim();
    const userId = String(body.userId ?? "").trim();
    if (!area || !userId) {
      return NextResponse.json({ error: "Informe a área e o usuário." }, { status: 400 });
    }
    await removeAreaManager(area, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao remover gestor de área.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
