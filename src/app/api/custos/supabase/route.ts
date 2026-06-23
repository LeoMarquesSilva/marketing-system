import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchSupabaseBillingDashboard } from "@/lib/supabase-billing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthenticatedUser();

    const dashboard = await fetchSupabaseBillingDashboard();
    return NextResponse.json(dashboard);
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg =
      err instanceof Error ? err.message : "Erro ao buscar custos do Supabase.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
