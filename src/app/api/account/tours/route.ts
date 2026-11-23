import { NextResponse } from "next/server";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

const TOUR_ID = /^[a-z0-9-]{3,80}$/;

/** A pessoa logada já viu este tour de novidades? (`?tour=<id>`) */
export async function GET(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const tourId = new URL(request.url).searchParams.get("tour") ?? "";
  if (!TOUR_ID.test(tourId)) return NextResponse.json({ error: "Tour inválido." }, { status: 400 });
  const db = await getServerDb();
  const { data, error } = await db
    .from("user_tour_views")
    .select("completed_at")
    .eq("user_id", auth.profile.id)
    .eq("tour_id", tourId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível consultar o tour." }, { status: 500 });
  return NextResponse.json({ seen: Boolean(data), completedAt: data?.completed_at ?? null });
}

/** Marca o tour como visto (concluído ou pulado). */
export async function POST(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { tourId?: string };
  const tourId = body.tourId ?? "";
  if (!TOUR_ID.test(tourId)) return NextResponse.json({ error: "Tour inválido." }, { status: 400 });
  const db = await getServerDb();
  const { error } = await db
    .from("user_tour_views")
    .upsert({ user_id: auth.profile.id, tour_id: tourId, completed_at: new Date().toISOString() }, { onConflict: "user_id,tour_id" });
  if (error) return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  return NextResponse.json({ success: true });
}
