import { NextResponse } from "next/server";
import {
  addCelebrationComment,
  CelebrationHttpError,
  deleteCelebrationComment,
  toggleCommentLike,
} from "@/lib/inicio/celebrations-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function failure(error: unknown): NextResponse {
  if (error instanceof CelebrationHttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[comemoracoes] comentário:", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "Não foi possível concluir. Tente de novo." }, { status: 500 });
}

/** Publica um comentário numa comemoração, com as pessoas marcadas. */
export async function POST(request: Request) {
  try {
    return NextResponse.json(await addCelebrationComment(await request.json().catch(() => null)), { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

/** Curte ou descurte uma mensagem (`{ id }`). */
export async function PUT(request: Request) {
  try {
    return NextResponse.json(await toggleCommentLike(await request.json().catch(() => null)), { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

/** Apaga um comentário (o autor ou um admin). */
export async function DELETE(request: Request) {
  try {
    await deleteCelebrationComment(await request.json().catch(() => null));
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
