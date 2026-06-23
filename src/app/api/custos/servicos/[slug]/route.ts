import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { upsertInfraService } from "@/lib/infra-services";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { slug } = await context.params;
    const body = (await request.json()) as {
      display_name?: string;
      provider?: string | null;
      logo_url?: string | null;
      category?: string | null;
      description?: string | null;
      billing_url?: string | null;
      monthly_amount_usd?: number | null;
      monthly_amount_brl?: number | null;
      sort_order?: number;
    };

    const service = await upsertInfraService(slug, body, user.id);
    return NextResponse.json(service);
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao salvar serviço.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
