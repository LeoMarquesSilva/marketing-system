import { NextResponse } from "next/server";
import {
  fetchMetaAdsDashboard,
  META_DATE_PRESETS,
  type MetaDatePreset,
} from "@/lib/meta-ads";
import { requireAuthenticatedUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const VALID_PRESETS = new Set<string>(META_DATE_PRESETS.map((p) => p.value));

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();

    const { searchParams } = new URL(request.url);
    const presetParam = searchParams.get("datePreset") ?? "maximum";
    const status = searchParams.get("status") ?? undefined;

    if (!VALID_PRESETS.has(presetParam)) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const dashboard = await fetchMetaAdsDashboard(presetParam as MetaDatePreset, {
      effectiveStatus: status && status !== "all" ? status : undefined,
    });

    return NextResponse.json(dashboard);
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg =
      err instanceof Error ? err.message : "Erro ao buscar dados de tráfego pago.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
