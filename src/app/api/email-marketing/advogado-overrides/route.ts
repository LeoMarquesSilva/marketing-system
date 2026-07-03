import { NextResponse } from "next/server";
import { createClient as createPublicClient } from "@/utils/supabase/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  listAdvogadoOverrides,
  listUnmatchedAdvogados,
  saveAdvogadoOverride,
} from "@/lib/sioe-sync-server";

export const dynamic = "force-dynamic";

async function resolveCurrentUserId(): Promise<string | null> {
  const supabase = await createPublicClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Lista advogados do SIOE sem usuário casado + overrides já cadastrados. */
export async function GET() {
  try {
    await requireAuthenticatedUser();
    const [unmatched, overrides] = await Promise.all([
      listUnmatchedAdvogados(),
      listAdvogadoOverrides(),
    ]);
    return NextResponse.json({ unmatched, overrides });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar vínculos de advogados.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Vincula manualmente um advogado_responsavel (SIOE) a um usuário do sistema. */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const advogadoNameNormalized = String(body.advogadoNameNormalized ?? "").trim();
    const userId = String(body.userId ?? "").trim();
    if (!advogadoNameNormalized || !userId) {
      return NextResponse.json({ error: "Informe o advogado e o usuário." }, { status: 400 });
    }
    const updatedBy = await resolveCurrentUserId();
    await saveAdvogadoOverride(advogadoNameNormalized, userId, updatedBy);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar vínculo.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
