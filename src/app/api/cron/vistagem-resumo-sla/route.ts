import { NextResponse } from "next/server";
import { resumoSlaDoJuridico } from "@/lib/vistagem/resumo-sla-server";

export const dynamic = "force-dynamic";

/** Só o n8n chama: o fluxo "SLA PUBLICAÇÕES - ORQUESTRA" lê este texto e posta no grupo do Teams. Não envia nada. */
function autorizado(request: Request): boolean {
  const token = process.env.VISTAGEM_RESUMO_SLA_TOKEN?.trim();
  if (!token) return false;
  return request.headers.get("authorization")?.trim() === `Bearer ${token}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    return NextResponse.json(await resumoSlaDoJuridico());
  } catch (error) {
    console.error("[cron/vistagem-resumo-sla]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível montar o resumo do SLA." }, { status: 500 });
  }
}
