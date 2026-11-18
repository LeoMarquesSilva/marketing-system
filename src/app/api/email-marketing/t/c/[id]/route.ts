import { NextResponse } from "next/server";
import { recordMailboxTracking, resolveTrackedLink } from "@/lib/email-marketing-mailbox";

export const dynamic = "force-dynamic";

const FALLBACK = "https://www.bismarchipires.com.br";

/** Clique em link de e-mail enviado pela caixa do sócio: conta e segue para o destino. Público. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const target = new URL(request.url).searchParams.get("u") ?? "";
  let destination = FALLBACK;
  try {
    const allowed = await resolveTrackedLink(id, target);
    if (allowed) {
      destination = allowed;
      await recordMailboxTracking(id, "clicked", { url: allowed, userAgent: request.headers.get("user-agent") });
    }
  } catch (err) {
    // Sem conseguir conferir o link, vai para o site (nunca para um endereço não verificado).
    console.error("[email-marketing/t/c]", err instanceof Error ? err.message : err);
  }
  return NextResponse.redirect(destination, { status: 302, headers: { "Cache-Control": "no-store" } });
}
