import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { markNpsSurveyLinkSent, NpsHttpError } from "@/lib/nps/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as {
      clientGroupId?: string;
      campaignId?: string | null;
    };

    if (!body.clientGroupId) {
      return NextResponse.json({ error: "Informe o grupo de empresas." }, { status: 400 });
    }

    const result = await markNpsSurveyLinkSent({
      authUserId: user.id,
      clientGroupId: body.clientGroupId,
      campaignId: body.campaignId ?? null,
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      alreadySent: result.alreadySent,
    });
  } catch (err) {
    if (err instanceof NpsHttpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao marcar NPS como enviado.";
    const status = message.includes("Não autenticado")
      ? 401
      : message.includes("Sem permissão")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
