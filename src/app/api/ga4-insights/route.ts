import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchGa4DashboardData } from "@/lib/ga4-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const data = await fetchGa4DashboardData();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar GA4 Insights.";
    const status = message.includes("Não autenticado") || message.includes("inativo") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
