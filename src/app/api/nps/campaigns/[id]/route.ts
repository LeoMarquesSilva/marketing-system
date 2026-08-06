import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { NpsHttpError, updateNpsCampaign } from "@/lib/nps/server";
import type { NpsCampaignStatus } from "@/lib/nps/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      status?: NpsCampaignStatus;
      startsAt?: string | null;
      endsAt?: string | null;
    };

    const campaign = await updateNpsCampaign({
      authUserId: user.id,
      campaignId: id,
      patch: {
        name: body.name,
        status: body.status,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
      },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    if (err instanceof NpsHttpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao atualizar campanha.";
    const status = message.includes("Não autenticado")
      ? 401
      : message.includes("Sem permissão")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
