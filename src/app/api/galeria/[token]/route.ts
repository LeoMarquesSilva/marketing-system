import { NextResponse } from "next/server";
import { recordShareOpen } from "@/lib/event-photos/shares-server";

export const dynamic = "force-dynamic";

/** Página do convidado aberta (sem login). O navegador chama uma vez por sessão; sem resposta útil. */
export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  await recordShareOpen(token).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
