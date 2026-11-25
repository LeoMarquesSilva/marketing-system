import { NextResponse } from "next/server";
import { downloadLink6x1, qualifyLead6x1, saveLead6x1, saveQuickLead6x1 } from "@/lib/leads/server";
import { normalizarOrigem } from "@/lib/leads/materiais";

export const dynamic = "force-dynamic";

/**
 * Formulário público do e-book "Fim da escala 6x1".
 * - etapa "lead": nome, WhatsApp, e-mail e "Você é:" liberam o PDF na hora (Linktree/Instagram e outros canais).
 * - etapa "qualificacao": as 5 perguntas depois do download, no cadastro que acabou de ser criado.
 * - sem etapa (e-mail da campanha, ?r=): as 5 perguntas + dados de uma vez, como antes.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      etapa?: "lead" | "qualificacao";
      r?: string;
      origem?: string;
      utm?: string;
      visitante?: string;
      lead?: string;
      nome?: string;
      email?: string;
      empresa?: string;
      telefone?: string;
      perfil?: string;
      respostas?: Record<string, string>;
      /** Campo escondido: robôs preenchem, pessoas não. */
      site?: string;
    };
    const userAgent = request.headers.get("user-agent");
    const source = normalizarOrigem(body.origem, body.utm);

    if (body.site) return NextResponse.json({ ok: true, downloadUrl: downloadLink6x1(null), leadId: null, wantsContact: false });

    if (body.etapa === "lead") {
      const { id, profile } = await saveQuickLead6x1({
        name: body.nome,
        email: body.email,
        phone: body.telefone,
        profile: body.perfil,
        source,
        visitorId: body.visitante,
        utmSource: body.utm,
        userAgent,
      });
      return NextResponse.json({ ok: true, leadId: id, profile, downloadUrl: downloadLink6x1(id, body.visitante) });
    }

    if (body.etapa === "qualificacao") {
      const { wantsContact } = await qualifyLead6x1({ leadId: body.lead, visitorId: body.visitante, answers: body.respostas ?? {} });
      return NextResponse.json({ ok: true, wantsContact });
    }

    const { id, wantsContact } = await saveLead6x1({
      recipientId: body.r ?? null,
      source,
      name: body.nome,
      email: body.email,
      company: body.empresa,
      phone: body.telefone,
      answers: body.respostas ?? {},
      visitorId: body.visitante,
      utmSource: body.utm,
      userAgent,
    });
    // A temperatura fica só para a equipe; quem respondeu recebe o e-book.
    return NextResponse.json({ ok: true, leadId: id, downloadUrl: downloadLink6x1(id, body.visitante), wantsContact });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível enviar suas respostas.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
