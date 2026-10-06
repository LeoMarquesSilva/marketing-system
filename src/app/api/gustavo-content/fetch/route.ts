import { NextResponse } from "next/server";
import { runGustavoContentFetchPipeline } from "@/lib/gustavo-content/pipeline";
import {
  GustavoContentError,
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Busca manual do radar. Roda o pipeline dentro do próprio request: disparar o
 * worker em fire-and-forget não funciona na Vercel (a função congela ao responder
 * e o worker nunca chega a rodar).
 */
export async function POST(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    if (!actor.isAdmin) {
      throw new GustavoContentError("Somente admin dispara a busca do radar.", 403);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const institutional = body.source === "institutional";
    const result = await runGustavoContentFetchPipeline({
      topicIds: Array.isArray(body.topicIds) ? body.topicIds.map(String) : undefined,
      maxCreated: typeof body.maxCreated === "number" ? body.maxCreated : 8,
      trigger: institutional ? "institutional" : "manual",
      source: institutional ? "institutional" : "rss",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
