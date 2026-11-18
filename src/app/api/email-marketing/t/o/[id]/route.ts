import { recordMailboxTracking } from "@/lib/email-marketing-mailbox";

export const dynamic = "force-dynamic";

// GIF transparente 1x1.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Abertura de e-mail enviado pela caixa do sócio (imagem invisível no fim da mensagem). Público. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await recordMailboxTracking(id, "opened", { userAgent: request.headers.get("user-agent") });
  } catch (err) {
    console.error("[email-marketing/t/o]", err instanceof Error ? err.message : err);
  }
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
