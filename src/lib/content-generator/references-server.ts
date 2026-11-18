/**
 * Servidor das referências: cadastra @ de escritórios, lê os posts públicos pela
 * Business Discovery da Meta e guarda em content_reference_posts.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchBusinessDiscovery } from "@/lib/instagram-meta";
import {
  accountFromRow,
  normalizeUsername,
  postFromRow,
  type ReferenceAccount,
  type ReferenceAccountRow,
  type ReferenceKind,
  type ReferencePost,
  type ReferencePostRow,
} from "@/lib/content-generator/references";

/** Perfis lidos há menos que isso não são lidos de novo na busca automática. */
const SYNC_MAX_AGE_HOURS = 20;
const REFERENCE_POSTS_PER_SYNC = 30;

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key);
}

/** Mensagem da Meta traduzida para quem cadastra o @. */
function friendlyMetaError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid user id|cannot be found|does not exist/i.test(message)) {
    return "A Meta não achou esse perfil. Confira o @ e se a conta é profissional (Business ou Criador de conteúdo).";
  }
  return message.slice(0, 200);
}

export async function listReferences(): Promise<{ accounts: ReferenceAccount[]; posts: ReferencePost[] }> {
  const db = adminDb();
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: accounts }, { data: posts }] = await Promise.all([
    db.from("content_reference_accounts").select("*").order("kind").order("username"),
    db
      .from("content_reference_posts")
      .select("id, account_id, caption, media_type, media_product_type, permalink, media_url, published_at, like_count, comments_count, followers_at_sync")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(1000),
  ]);
  return {
    accounts: ((accounts ?? []) as ReferenceAccountRow[]).map(accountFromRow),
    posts: ((posts ?? []) as ReferencePostRow[]).map(postFromRow),
  };
}

/** Lê um perfil na Meta e grava conta + posts. Devolve o erro amigável quando falha. */
async function syncAccount(row: Pick<ReferenceAccountRow, "id" | "username">): Promise<{ ok: boolean; error?: string; posts?: number }> {
  const db = adminDb();
  try {
    const profile = await fetchBusinessDiscovery(row.username, REFERENCE_POSTS_PER_SYNC);
    const syncedAt = new Date().toISOString();
    await db
      .from("content_reference_accounts")
      .update({
        display_name: profile.name,
        followers_count: profile.followers_count,
        media_count: profile.media_count,
        profile_picture_url: profile.profile_picture_url,
        last_synced_at: syncedAt,
        last_error: null,
      })
      .eq("id", row.id);
    if (profile.media.length) {
      const { error } = await db.from("content_reference_posts").upsert(
        profile.media.map((media) => ({
          account_id: row.id,
          ig_media_id: media.id,
          caption: media.caption ?? null,
          media_type: media.media_type ?? null,
          media_product_type: media.media_product_type ?? null,
          permalink: media.permalink ?? null,
          media_url: media.media_url ?? null,
          published_at: media.timestamp ?? null,
          like_count: media.like_count ?? null,
          comments_count: media.comments_count ?? null,
          followers_at_sync: profile.followers_count,
          synced_at: syncedAt,
        })),
        { onConflict: "ig_media_id" },
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true, posts: profile.media.length };
  } catch (err) {
    const message = friendlyMetaError(err);
    await db.from("content_reference_accounts").update({ last_error: message }).eq("id", row.id);
    return { ok: false, error: message };
  }
}

/** Lê os perfis ativos (só os desatualizados, a menos que `force`). */
export async function syncReferenceAccounts(options: { force?: boolean } = {}): Promise<{ synced: number; failed: number }> {
  const db = adminDb();
  const { data } = await db.from("content_reference_accounts").select("id, username, last_synced_at").eq("is_active", true);
  const cutoff = Date.now() - SYNC_MAX_AGE_HOURS * 60 * 60 * 1000;
  const due = (data ?? []).filter(
    (row) => options.force || !row.last_synced_at || new Date(row.last_synced_at as string).getTime() < cutoff,
  ) as Pick<ReferenceAccountRow, "id" | "username">[];
  let synced = 0;
  let failed = 0;
  for (const row of due) {
    const result = await syncAccount(row);
    if (result.ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}

export async function addReferenceAccount(input: {
  username: string;
  kind: ReferenceKind;
  focusArea: string;
  actorName: string | null;
}): Promise<{ account?: ReferenceAccount; error?: string }> {
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9._]{1,30}$/.test(username)) return { error: "Digite o @ do perfil (ex.: tozzinifreire)." };
  // Confere na Meta antes de gravar: @ errado ou conta pessoal não entram.
  try {
    await fetchBusinessDiscovery(username, 1);
  } catch (err) {
    return { error: friendlyMetaError(err) };
  }
  const db = adminDb();
  const { data, error } = await db
    .from("content_reference_accounts")
    .insert({ username, kind: input.kind, focus_area: input.focusArea || "Geral", created_by_name: input.actorName })
    .select("*")
    .single();
  if (error) {
    return { error: /duplicate|unique/i.test(error.message) ? "Esse perfil já está na lista." : "Não foi possível salvar o perfil." };
  }
  await syncAccount(data as ReferenceAccountRow);
  const { data: fresh } = await db.from("content_reference_accounts").select("*").eq("id", (data as ReferenceAccountRow).id).single();
  return { account: accountFromRow((fresh ?? data) as ReferenceAccountRow) };
}

export async function updateReferenceAccount(
  id: string,
  patch: Partial<{ kind: ReferenceKind; focusArea: string; isActive: boolean }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.kind) row.kind = patch.kind;
  if (patch.focusArea) row.focus_area = patch.focusArea;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  const { error } = await adminDb().from("content_reference_accounts").update(row).eq("id", id);
  if (error) throw new Error("Não foi possível salvar o perfil.");
}

/** Tira o perfil da lista (e os posts guardados dele). */
export async function removeReferenceAccount(id: string): Promise<void> {
  const { error } = await adminDb().from("content_reference_accounts").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o perfil.");
}
