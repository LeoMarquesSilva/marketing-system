import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchEventsOverview, fetchEventsWithStats } from "@/lib/eventos";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const [events, overview] = await Promise.all([
    fetchEventsWithStats(year, supabase),
    fetchEventsOverview(year, supabase),
  ]);

  return NextResponse.json({ events, overview, year });
}
