import { NextResponse } from "next/server";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { getServerDb } from "@/lib/users-server";
import {
  countUnseenDeliveryNotices,
  listMyDeliveries,
  markDeliveryNoticesSeen,
} from "@/lib/request-files/deliveries-server";

export const dynamic = "force-dynamic";

/**
 * Minhas entregas: o que o Marketing concluiu para a pessoa logada.
 * `?contagem=1` devolve só o número de avisos não vistos (sino da barra lateral).
 */
export async function GET(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const db = await getServerDb();
    if (new URL(request.url).searchParams.get("contagem") === "1") {
      return NextResponse.json({ unseen: await countUnseenDeliveryNotices(db, auth.profile.id) });
    }
    return NextResponse.json({ deliveries: await listMyDeliveries(db, auth.profile.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao carregar entregas." }, { status: 500 });
  }
}

/** Marca avisos como vistos (todos, ou os ids enviados). */
export async function PATCH(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  try {
    const db = await getServerDb();
    await markDeliveryNoticesSeen(db, auth.profile.id, Array.isArray(body.ids) ? body.ids : undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao marcar avisos." }, { status: 500 });
  }
}
