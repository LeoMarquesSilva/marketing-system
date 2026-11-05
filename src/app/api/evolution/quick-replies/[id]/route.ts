import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  archiveQuickReply,
  markQuickReplyUsed,
  QuickReplyError,
  quickReplyEditor,
  updateQuickReply,
  type QuickReplyInput,
} from "@/lib/whatsapp-quick-replies-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function currentAuthId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function requireEditor() {
  const authId = await currentAuthId();
  if (!authId) throw new QuickReplyError("Não autenticado.", 401);
  const editor = await quickReplyEditor(authId);
  if (!editor.canManage || !editor.userId) {
    throw new QuickReplyError("Sem permissão para editar as respostas prontas.", 403);
  }
  return editor.userId;
}

function errorResponse(err: unknown, fallback: string, tag: string) {
  if (err instanceof QuickReplyError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[evolution/quick-replies ${tag}]`, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Conta um uso (quem atende escolheu a resposta no campo de mensagem). */
export async function POST(_request: Request, { params }: Params) {
  try {
    if (!(await currentAuthId())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const { id } = await params;
    await markQuickReplyUsed(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "Não foi possível registrar o uso.", "POST");
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireEditor();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as QuickReplyInput;
    const reply = await updateQuickReply(id, body, userId);
    return NextResponse.json({ reply });
  } catch (err) {
    return errorResponse(err, "Não foi possível salvar a resposta.", "PATCH");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const userId = await requireEditor();
    const { id } = await params;
    await archiveQuickReply(id, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "Não foi possível excluir a resposta.", "DELETE");
  }
}
