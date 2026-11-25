import { NextResponse } from "next/server";
import { PRODUTOS_COM_EVENTOS, recordMaterialEvent } from "@/lib/leads/server";
import { EVENTOS_DA_PAGINA, normalizarOrigem, type EventoMaterial } from "@/lib/leads/materiais";

export const dynamic = "force-dynamic";

/**
 * Passos do funil que a página pública manda sozinha (visita e início do formulário), por navigator.sendBeacon.
 * Sem IP: só o id anônimo do navegador, a origem, o utm_source e o referenciador.
 */
export async function POST(request: Request) {
  const body = (await request
    .text()
    .then((text) => JSON.parse(text))
    .catch(() => ({}))) as {
    produto?: string;
    evento?: string;
    visitante?: string;
    origem?: string;
    utm?: string;
    ref?: string;
    email?: boolean;
  };

  if (!body.produto || !PRODUTOS_COM_EVENTOS.has(body.produto)) return new NextResponse(null, { status: 204 });
  if (!EVENTOS_DA_PAGINA.includes(body.evento as EventoMaterial)) return new NextResponse(null, { status: 204 });

  await recordMaterialEvent({
    product: body.produto,
    event: body.evento as EventoMaterial,
    // Quem chega pelo e-mail da campanha (?r=) conta como e-mail.
    source: body.email ? "email" : normalizarOrigem(body.origem, body.utm) ?? "direto",
    visitorId: body.visitante,
    utmSource: body.utm,
    referrer: body.ref,
    userAgent: request.headers.get("user-agent"),
  });
  return new NextResponse(null, { status: 204 });
}
