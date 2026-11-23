import { NextResponse } from "next/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import {
  addReferenceAccount,
  listReferences,
  removeReferenceAccount,
  syncReferenceAccounts,
  updateReferenceAccount,
} from "@/lib/content-generator/references-server";
import { summarizeReferences, type ReferenceKind } from "@/lib/content-generator/references";
import { TOPIC_AREAS } from "@/lib/content-generator/topics";

export const dynamic = "force-dynamic";
// "Atualizar agora" lê cada perfil na Meta (1–2 s por perfil).
export const maxDuration = 120;

const KINDS: ReferenceKind[] = ["referencia", "concorrente"];

async function requireManager() {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (!isContentManager(auth.profile)) {
    return { error: NextResponse.json({ error: "Só a equipe de Marketing mexe nas referências." }, { status: 403 }) };
  }
  return { profile: auth.profile };
}

async function payload() {
  const { accounts, posts } = await listReferences();
  return { summaries: summarizeReferences(accounts, posts) };
}

export async function GET() {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await payload());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao carregar referências." }, { status: 500 });
  }
}

/** Adiciona um @ (confere na Meta antes) ou, com `action: "sync"`, lê todos os perfis agora. */
export async function POST(request: Request) {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { action?: string; username?: string; kind?: string; focusArea?: string };
  try {
    if (body.action === "sync") {
      const result = await syncReferenceAccounts({ force: true });
      return NextResponse.json({ ...result, ...(await payload()) });
    }
    const kind = KINDS.includes(body.kind as ReferenceKind) ? (body.kind as ReferenceKind) : "referencia";
    const focusArea = (TOPIC_AREAS as readonly string[]).includes(body.focusArea ?? "") ? (body.focusArea as string) : "Geral";
    const result = await addReferenceAccount({ username: body.username ?? "", kind, focusArea, actorName: auth.profile.name });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(await payload(), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao salvar referência." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { id?: string; kind?: string; focusArea?: string; isActive?: boolean };
  if (!body.id) return NextResponse.json({ error: "Perfil não informado." }, { status: 400 });
  try {
    await updateReferenceAccount(body.id, {
      kind: KINDS.includes(body.kind as ReferenceKind) ? (body.kind as ReferenceKind) : undefined,
      focusArea: (TOPIC_AREAS as readonly string[]).includes(body.focusArea ?? "") ? body.focusArea : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    return NextResponse.json(await payload());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao salvar referência." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Perfil não informado." }, { status: 400 });
  try {
    await removeReferenceAccount(id);
    return NextResponse.json(await payload());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao remover referência." }, { status: 500 });
  }
}
