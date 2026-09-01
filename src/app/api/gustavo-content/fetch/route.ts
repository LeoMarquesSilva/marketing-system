import { NextResponse } from "next/server";
import { getInternalJobSecret } from "@/lib/cron-auth";
import {
  GustavoContentError,
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function resolveWorkerBaseUrl(request: Request): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    if (!actor.isAdmin) {
      throw new GustavoContentError("Somente admin dispara a busca do radar.", 403);
    }

    const secret = getInternalJobSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Segredo interno do servidor não configurado." },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const url = `${resolveWorkerBaseUrl(request)}/api/gustavo-content/fetch-worker`;
    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        topicIds: body.topicIds,
        maxCreated: body.maxCreated,
        trigger: body.source === "institutional" ? "institutional" : "manual",
        source: body.source === "institutional" ? "institutional" : "rss",
      }),
    }).catch((err) => {
      console.error("[gustavo-content/fetch] falha ao disparar worker", err);
    });

    return NextResponse.json(
      {
        started: true,
        message: "Busca do radar iniciada. As pautas aparecem em alguns minutos.",
      },
      { status: 202 }
    );
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
