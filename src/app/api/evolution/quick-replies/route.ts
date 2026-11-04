import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  createQuickReply,
  listQuickReplies,
  QuickReplyError,
  quickReplyEditor,
  type QuickReplyInput,
} from "@/lib/whatsapp-quick-replies-server";

export const dynamic = "force-dynamic";

async function currentAuthId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Respostas prontas do atendimento e se quem pede pode editá-las. */
export async function GET() {
  try {
    const authId = await currentAuthId();
    if (!authId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const [replies, editor] = await Promise.all([listQuickReplies(), quickReplyEditor(authId)]);
    return NextResponse.json({ replies, canManage: editor.canManage });
  } catch (err) {
    console.error("[evolution/quick-replies GET]", err);
    return NextResponse.json({ error: "Não foi possível carregar as respostas prontas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authId = await currentAuthId();
    if (!authId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const editor = await quickReplyEditor(authId);
    if (!editor.canManage || !editor.userId) {
      return NextResponse.json({ error: "Sem permissão para editar as respostas prontas." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as QuickReplyInput;
    const reply = await createQuickReply(body, editor.userId);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof QuickReplyError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[evolution/quick-replies POST]", err);
    return NextResponse.json({ error: "Não foi possível salvar a resposta." }, { status: 500 });
  }
}
