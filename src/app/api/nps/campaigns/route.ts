import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  createNpsCampaign,
  listNpsCampaigns,
  NpsHttpError,
} from "@/lib/nps/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const campaigns = await listNpsCampaigns(user.id);
    return NextResponse.json({ campaigns });
  } catch (err) {
    if (err instanceof NpsHttpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao listar campanhas.";
    const status = message.includes("Não autenticado")
      ? 401
      : message.includes("Sem permissão")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as {
      name?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      activate?: boolean;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Informe o nome da campanha." }, { status: 400 });
    }

    const campaign = await createNpsCampaign({
      authUserId: user.id,
      name: body.name,
      startsAt: body.startsAt ?? null,
      endsAt: body.endsAt ?? null,
      activate: Boolean(body.activate),
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    if (err instanceof NpsHttpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao criar campanha.";
    const status = message.includes("Não autenticado")
      ? 401
      : message.includes("Sem permissão")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
