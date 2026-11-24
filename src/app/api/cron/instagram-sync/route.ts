import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runInstagramSync, type InstagramSyncKind } from "@/lib/instagram-sync-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KINDS: InstagramSyncKind[] = ["daily", "full", "stories"];

/**
 * Cron do Instagram (vercel.json):
 * - sem `mode` ou `mode=daily`: todo dia às 6h (posts recentes, conta, demografia, stories, concorrentes);
 * - `mode=stories`: a cada 4 h (stories somem em 24 h);
 * - `mode=full`: domingo (todos os posts desde 2025).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const mode = new URL(request.url).searchParams.get("mode") ?? "daily";
  const kind = (KINDS as string[]).includes(mode) ? (mode as InstagramSyncKind) : "daily";

  try {
    const result = await runInstagramSync(kind, { trigger: "cron" });
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar Instagram.";
    console.error("[cron/instagram-sync]", kind, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
