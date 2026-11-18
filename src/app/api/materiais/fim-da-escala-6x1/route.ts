import { NextResponse } from "next/server";
import { ebook6x1Url, saveLead6x1 } from "@/lib/leads/server";

export const dynamic = "force-dynamic";

/** Formulário público do e-book "Fim da escala 6x1": grava as respostas e libera o PDF. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      r?: string;
      origem?: string;
      nome?: string;
      email?: string;
      empresa?: string;
      telefone?: string;
      respostas?: Record<string, string>;
      /** Campo escondido: robôs preenchem, pessoas não. */
      site?: string;
    };
    if (body.site) return NextResponse.json({ ok: true, downloadUrl: ebook6x1Url(), wantsContact: false });

    const { wantsContact } = await saveLead6x1({
      recipientId: body.r ?? null,
      source: body.origem ?? null,
      name: body.nome,
      email: body.email,
      company: body.empresa,
      phone: body.telefone,
      answers: body.respostas ?? {},
      userAgent: request.headers.get("user-agent"),
    });
    // A temperatura fica só para a equipe; quem respondeu recebe o e-book.
    return NextResponse.json({ ok: true, downloadUrl: ebook6x1Url(), wantsContact });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível enviar suas respostas.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
