import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  addInfraServicePayment,
  deleteInfraServicePayment,
} from "@/lib/infra-services";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAuthenticatedUser();
    const { slug } = await context.params;
    const body = (await request.json()) as {
      period_month: string;
      paid_at?: string | null;
      amount_usd?: number | null;
      amount_brl: number;
      description?: string;
    };

    if (!body.period_month || (body.amount_brl == null && body.amount_usd == null)) {
      return NextResponse.json(
        { error: "Mês e valor (BRL ou USD) são obrigatórios." },
        { status: 400 }
      );
    }

    const payment = await addInfraServicePayment(slug, {
      ...body,
      amount_brl: body.amount_brl ?? 0,
    });
    return NextResponse.json(payment);
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao registrar pagamento.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID do pagamento obrigatório." }, { status: 400 });
    }
    await deleteInfraServicePayment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao excluir pagamento.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
