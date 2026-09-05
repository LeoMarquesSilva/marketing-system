import { NextResponse } from "next/server";
import { listItems } from "@/lib/gustavo-content/items";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";
import type { GustavoContentStatus } from "@/lib/gustavo-content/constants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireGustavoContentAccess();
    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    const topicId = url.searchParams.get("topicId") ?? undefined;
    const statuses = statusesForView(view);
    const items = await listItems({ statuses, topicId });
    return NextResponse.json(items);
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}

function statusesForView(view: string | null): GustavoContentStatus[] | undefined {
  if (view === "radar") return ["radar", "sugestao", "aguardando_opiniao"];
  if (view === "producao") {
    return ["sugestao", "aguardando_opiniao", "rascunho", "aguardando_aprovacao", "aprovado", "enviado_mkt", "rejeitado"];
  }
  if (view === "historico") return ["enviado_mkt", "publicado", "rejeitado", "arquivado"];
  return undefined;
}
