import { NextResponse } from "next/server";
import { runCafeCulturaAutomation } from "@/lib/cafe-cultura/responsum";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await runCafeCulturaAutomation();
    if (result.results.some((edition) => !edition.success)) {
      console.error("[cron/cafe-cultura-sync] uma ou mais edições falharam", {
        editions: result.editions,
        failed: result.results.filter((edition) => !edition.success).length,
      });
      return NextResponse.json(
        { success: false, ...result, finishedAt: new Date().toISOString() },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na automação do Café com Cultura.";
    console.error("[cron/cafe-cultura-sync]", message);
    return NextResponse.json({ error: "Não foi possível concluir a automação do Café com Cultura." }, { status: 500 });
  }
}
