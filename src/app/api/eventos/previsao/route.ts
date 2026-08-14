import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchEventsForecast } from "@/lib/eventos";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear() + 1);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const forecast = await fetchEventsForecast(year, supabase);

  return NextResponse.json({ forecast });
}
