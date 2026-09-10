import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { parseCertificadoWorkshopDescription } from "@/lib/certificado-workshop";
import { triggerPresencaSyncForTicket } from "@/lib/certificado-workshop-attendance";

export const maxDuration = 60;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase não configurado.");
  return createServiceClient(url, key);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { id } = await params;

    const admin = getAdminClient();
    const { data: card, error } = await admin
      .from("marketing_requests")
      .select("id, description, request_type")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!card || card.request_type !== "Certificados") {
      return NextResponse.json({ error: "Este card não é um certificado sincronizado do Responsum." }, { status: 400 });
    }

    const ticketId = parseCertificadoWorkshopDescription(card.description)?.ticketId;
    if (!ticketId) {
      return NextResponse.json({ error: "Não encontrei o Ticket ID na descrição deste card." }, { status: 400 });
    }

    const result = await triggerPresencaSyncForTicket(ticketId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = /não autenticado/i.test(message) ? 401 : /inativo/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
