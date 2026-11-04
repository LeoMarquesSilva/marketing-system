import { NextResponse } from "next/server";
import { canAccessPath } from "@/lib/access-control";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/email-marketing-server";
import { fetchEventsForecast } from "@/lib/eventos";
import { buildPlanejamentoSheets } from "@/lib/eventos-planilha";
import { buildPlanejamentoWorkbook } from "@/lib/eventos-planilha-excel";
import { fetchPlanejamentoDetails } from "@/lib/eventos-planilha-server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Planilha do planejamento anual de eventos: calendário do ano com budget,
 * detalhes de cada evento (orçamento, propostas, fornecedores, arquivos),
 * histórico e fornecedores. ?year=2027&reajuste=5 (reajuste em %).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { data: profile, error } = await getAdminClient()
      .from("users")
      .select("id, role, permissions")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (error) throw new Error("Falha ao verificar permissões.");
    if (!profile || !canAccessPath(profile, "/eventos")) {
      return NextResponse.json({ error: "Sem permissão para Eventos." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year") ?? new Date().getFullYear() + 1);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
    }
    const percent = Number((searchParams.get("reajuste") ?? "0").replace(",", "."));
    if (!Number.isFinite(percent) || percent < -100 || percent > 1000) {
      return NextResponse.json({ error: "Reajuste inválido." }, { status: 400 });
    }

    const db = await createClient();
    const forecast = await fetchEventsForecast(year, db);
    const details = await fetchPlanejamentoDetails(
      forecast.editions.map((e) => e.eventId),
      db
    );
    const sheets = buildPlanejamentoSheets(forecast, details, percent / 100, new Date());
    const data = await buildPlanejamentoWorkbook(sheets);

    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="planejamento-eventos-${year}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /não autenticado/i.test(message) ? 401 : /inativo/i.test(message) ? 403 : 500;
    if (status === 500) console.error("Erro ao gerar a planilha do planejamento:", error);
    return NextResponse.json(
      { error: status === 500 ? "Não foi possível gerar a planilha. Tente de novo." : message },
      { status }
    );
  }
}
