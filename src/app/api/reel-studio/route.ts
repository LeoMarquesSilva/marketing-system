import { NextResponse } from "next/server";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { getServerDb } from "@/lib/users-server";
import {
  currentReelMonth,
  reelStudioCreateSchema,
  reelStudioUpdateSchema,
  type ReelStudioAssignee,
  type ReelStudioItem,
} from "@/lib/reel-studio";

type ReelStudioRow = Omit<ReelStudioItem, "assignees"> & {
  reel_studio_assignees?: ReelStudioAssignee[] | null;
};

function mapItem(row: ReelStudioRow): ReelStudioItem {
  const { reel_studio_assignees, ...item } = row;
  return { ...item, assignees: reel_studio_assignees ?? [] };
}

async function requireStudioUser() {
  const auth = await getAuthenticatedContentUser();
  if (!auth) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (!auth.profile) {
    return { error: NextResponse.json({ error: "Perfil de conteúdo não encontrado." }, { status: 403 }) };
  }
  return { auth };
}

async function resolveAssignees(ids: string[]) {
  const db = await getServerDb();
  const { data, error } = await db
    .from("users")
    .select("id, name")
    .in("id", ids)
    .or("is_active.eq.true,is_active.is.null");

  if (error || !data || data.length !== ids.length) return null;
  const byId = new Map(data.map((user) => [user.id, user.name]));
  return ids.map((id) => ({ user_id: id, user_name: byId.get(id) ?? "Colaborador" }));
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireStudioUser();
  if ("error" in access) return access.error;

  const requestedMonth = new URL(request.url).searchParams.get("month");
  const month = /^\d{4}-\d{2}-01$/.test(requestedMonth ?? "")
    ? requestedMonth!
    : currentReelMonth();
  const db = await getServerDb();

  const [{ data: items, error: itemsError }, { data: collaborators, error: collaboratorsError }] =
    await Promise.all([
      db
        .from("reel_studio_items")
        .select("*, reel_studio_assignees(user_id, user_name)")
        .eq("production_month", month)
        .order("created_at", { ascending: false }),
      db
        .from("users")
        .select("id, name, department, avatar_url")
        .or("is_active.eq.true,is_active.is.null")
        .order("name"),
    ]);

  if (itemsError || collaboratorsError) {
    return NextResponse.json(
      { error: itemsError?.message ?? collaboratorsError?.message ?? "Não foi possível carregar o estúdio." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: ((items ?? []) as ReelStudioRow[]).map(mapItem),
    collaborators: collaborators ?? [],
  });
}

export async function POST(request: Request) {
  const access = await requireStudioUser();
  if ("error" in access) return access.error;
  const profile = access.auth.profile;
  if (!profile) return NextResponse.json({ error: "Perfil de conteúdo não encontrado." }, { status: 403 });

  const parsed = reelStudioCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados do roteiro e os responsáveis." }, { status: 400 });
  }

  const assignees = await resolveAssignees(parsed.data.collaborator_ids);
  if (!assignees) {
    return NextResponse.json({ error: "Não foi possível localizar todos os colaboradores selecionados." }, { status: 400 });
  }

  const db = await getServerDb();
  const { data: item, error: itemError } = await db
    .from("reel_studio_items")
    .insert({
      production_month: parsed.data.production_month,
      title: parsed.data.title,
      area: parsed.data.area || null,
      original_script: parsed.data.original_script,
      created_by_id: profile.id,
      created_by_name: profile.name,
    })
    .select("*")
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: itemError?.message ?? "Não foi possível salvar o roteiro." }, { status: 500 });
  }

  const { error: assigneeError } = await db
    .from("reel_studio_assignees")
    .insert(assignees.map((assignee) => ({ ...assignee, reel_id: item.id })));

  if (assigneeError) {
    await db.from("reel_studio_items").delete().eq("id", item.id);
    return NextResponse.json({ error: "Não foi possível vincular os responsáveis ao roteiro." }, { status: 500 });
  }

  return NextResponse.json({ item: { ...(item as Omit<ReelStudioItem, "assignees">), assignees } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requireStudioUser();
  if ("error" in access) return access.error;

  const parsed = reelStudioUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Não foi possível atualizar esse roteiro." }, { status: 400 });
  }

  const { id, collaborator_ids, ...updates } = parsed.data;
  const db = await getServerDb();

  if (Object.keys(updates).length > 0) {
    const { error } = await db.from("reel_studio_items").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (collaborator_ids) {
    const assignees = await resolveAssignees(collaborator_ids);
    if (!assignees) {
      return NextResponse.json({ error: "Não foi possível localizar todos os colaboradores selecionados." }, { status: 400 });
    }
    const { error: deleteError } = await db.from("reel_studio_assignees").delete().eq("reel_id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    const { error: insertError } = await db
      .from("reel_studio_assignees")
      .insert(assignees.map((assignee) => ({ ...assignee, reel_id: id })));
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
