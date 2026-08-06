import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getOrCreateSurveyLink, NpsHttpError } from "@/lib/nps/server";

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

    const bundle = await getOrCreateSurveyLink({
      authUserId: user.id,
      clientGroupId: body.clientGroupId,
      campaignId: body.campaignId ?? null,
    });

    return NextResponse.json({
      success: true,
      link: bundle.link,
      campaign: bundle.campaign,
      groupName: bundle.groupName,
      surveyUrl: bundle.surveyUrl,
      whatsappMessage: bundle.whatsappMessage,
      eligibleCount: bundle.eligibleCount,
      respondents: bundle.respondents,
      sent: bundle.sent,
    });
  } catch (err) {
    if (err instanceof NpsHttpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao gerar link NPS.";
    const status = message.includes("Não autenticado")
      ? 401
      : message.includes("Sem permissão")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
