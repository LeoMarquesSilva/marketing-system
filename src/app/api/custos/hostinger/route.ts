import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchHostingerBillingDashboard } from "@/lib/hostinger-billing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();

    const { searchParams } = new URL(request.url);
    const sync = searchParams.get("sync") === "1";

    const dashboard = await fetchHostingerBillingDashboard({ sync });
    return NextResponse.json(dashboard);
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg =
      err instanceof Error ? err.message : "Erro ao buscar custos da Hostinger.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
