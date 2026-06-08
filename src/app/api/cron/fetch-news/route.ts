import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Cron diário — dispara worker de busca de notícias (execução longa em função separada). */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : new URL(request.url).origin;

  void fetch(`${baseUrl}/api/content-roteiros/fetch-worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ maxCreated: 30 }),
  }).catch((err) => {
    console.error("[cron/fetch-news] falha ao disparar worker", err);
  });

  return NextResponse.json({
    started: true,
    message: "Busca de notícias disparada em segundo plano.",
    finishedAt: new Date().toISOString(),
  });
}
