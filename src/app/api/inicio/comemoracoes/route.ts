import { NextResponse } from "next/server";
import {
  CelebrationHttpError,
  getCelebration,
  toggleCelebrationLike,
  toggleCelebrationPraise,
} from "@/lib/inicio/celebrations-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function failure(error: unknown): NextResponse {
  if (error instanceof CelebrationHttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[comemoracoes]", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "Não foi possível concluir. Tente de novo." }, { status: 500 });
}

/** Curtidas e comentários de uma comemoração (`?pessoa=&tipo=&ano=`). */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const detail = await getCelebration({
      employeeId: params.get("pessoa"),
      kind: params.get("tipo"),
      year: Number(params.get("ano")),
    });
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

/** Parabeniza (curte ou descurte) ou, com `praise`, dá ou tira um elogio. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { praise?: unknown } | null;
    const result = body?.praise ? await toggleCelebrationPraise(body) : await toggleCelebrationLike(body);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
