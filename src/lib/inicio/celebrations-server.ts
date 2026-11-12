import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { getServerDb } from "@/lib/users-server";
import { canSeeHome, isAdminRole } from "@/lib/access-control";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { awardPhotoUrl } from "@/lib/rh/bp-awards/format";
import { loadPeopleDirectory } from "@/lib/rh/people-directory";
import { BIRTHDAY_ART_KINDS, type BirthdayArtKind } from "./birthday-arts";
import {
  CELEBRATION_COMMENT_MAX,
  CELEBRATION_MENTIONS_MAX,
  CELEBRATION_PRAISES,
  CELEBRATION_PRAISE_KEYS,
  CELEBRATION_WINDOW_DAYS,
  celebrationKey,
  type CelebrationComment,
  type CelebrationDetail,
  type CelebrationTarget,
} from "./celebrations";
import { daysUntilAnniversary, todayInBrasilia } from "./dates";

const LOG = "comemoracoes";

export class CelebrationHttpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "CelebrationHttpError";
  }
}

type Viewer = { db: SupabaseClient; userId: string; isAdmin: boolean };

/** Quem está logado e enxerga a tela inicial. */
async function requireViewer(): Promise<Viewer> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new CelebrationHttpError("Não autenticado.", 401);
  const db = (await getServerDb()) as SupabaseClient;
  const { data } = await db.from("users").select("id, role, permissions, is_active").eq("auth_id", user.id).maybeSingle();
  if (!data || data.is_active === false) throw new CelebrationHttpError("Usuário não encontrado.", 404);
  const profile = data as { id: string; role: string | null; permissions: string[] | null };
  if (!canSeeHome(profile)) throw new CelebrationHttpError("Sem acesso às felicitações.", 403);
  return { db, userId: profile.id, isAdmin: isAdminRole(profile) };
}

const targetSchema = z.object({
  employeeId: z.string().uuid("Pessoa inválida."),
  kind: z.enum(BIRTHDAY_ART_KINDS as [BirthdayArtKind, ...BirthdayArtKind[]], { message: "Tipo de comemoração inválido." }),
  year: z.number().int().min(2020).max(2100),
});
const commentSchema = targetSchema.extend({
  body: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Escreva o comentário.").max(CELEBRATION_COMMENT_MAX, `O comentário passa de ${CELEBRATION_COMMENT_MAX} caracteres.`)),
  mentions: z.array(z.string().uuid()).max(CELEBRATION_MENTIONS_MAX, `Marque até ${CELEBRATION_MENTIONS_MAX} pessoas.`).default([]),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new CelebrationHttpError(result.error.issues[0]?.message ?? "Dados inválidos.", 400);
  return result.data;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Há quantos dias a data (aniversário ou admissão) foi comemorada, dentro da
 * janela de felicitações: 0 = hoje. Fora da janela devolve null.
 */
export function daysSinceCelebration(date: string, today: string): { daysAgo: number; year: number } | null {
  for (let daysAgo = 0; daysAgo <= CELEBRATION_WINDOW_DAYS; daysAgo += 1) {
    const day = addDays(today, -daysAgo);
    if (daysUntilAnniversary(date, day) === 0) return { daysAgo, year: Number(day.slice(0, 4)) };
  }
  return null;
}

/** A comemoração existe e está na janela em que se pode curtir e comentar? */
async function canInteractWith(db: SupabaseClient, target: CelebrationTarget): Promise<boolean> {
  const { data } = await db
    .from("hr_employees")
    .select("birth_date, admission_date, is_active")
    .eq("id", target.employeeId)
    .maybeSingle();
  if (!data || data.is_active === false) throw new CelebrationHttpError("Pessoa não encontrada.", 404);
  const date = (target.kind === "aniversario" ? data.birth_date : data.admission_date) as string | null;
  if (!date) return false;
  const since = daysSinceCelebration(date, todayInBrasilia());
  if (!since || since.year !== target.year) return false;
  // Aniversário de empresa só conta a partir de um ano de casa.
  return target.kind === "aniversario" || since.year - Number(date.slice(0, 4)) >= 1;
}

export type CelebrationCounts = { likes: number; liked: boolean; comments: number };

/** Curtidas e comentários de várias comemorações de uma vez (chave: `celebrationKey`). */
export async function celebrationCounts(
  db: SupabaseClient,
  targets: CelebrationTarget[],
  userId: string
): Promise<Map<string, CelebrationCounts>> {
  const result = new Map<string, CelebrationCounts>();
  if (targets.length === 0) return result;
  const ids = [...new Set(targets.map((target) => target.employeeId))];
  const years = [...new Set(targets.map((target) => target.year))];
  const [reactions, comments] = await Promise.all([
    db.from("hr_celebration_reactions").select("employee_id, kind, year, user_id").in("employee_id", ids).in("year", years),
    db.from("hr_celebration_comments").select("employee_id, kind, year").in("employee_id", ids).in("year", years),
  ]);
  if (reactions.error || comments.error) {
    console.error(`[${LOG}] contagem:`, reactions.error?.message ?? comments.error?.message);
    return result;
  }
  const entry = (row: { employee_id: unknown; kind: unknown; year: unknown }) => {
    const key = celebrationKey({ employeeId: row.employee_id as string, kind: row.kind as BirthdayArtKind, year: row.year as number });
    const current = result.get(key) ?? { likes: 0, liked: false, comments: 0 };
    result.set(key, current);
    return current;
  };
  for (const row of reactions.data ?? []) {
    const current = entry(row);
    current.likes += 1;
    if (row.user_id === userId) current.liked = true;
  }
  for (const row of comments.data ?? []) entry(row).comments += 1;
  return result;
}

function shortName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Alguém";
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

type UserRow = { id: string; name: string | null; department: string | null; avatar_url: string | null; photo_onedrive_url: string | null };

async function loadUsers(db: SupabaseClient, ids: string[]): Promise<Map<string, UserRow>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from("users").select("id, name, department, avatar_url, photo_onedrive_url").in("id", ids);
  if (error) console.error(`[${LOG}] autores:`, error.message);
  return new Map(((data ?? []) as UserRow[]).map((row) => [row.id, row]));
}

/** Curtidas, comentários e a equipe para marcar, de uma comemoração. */
export async function getCelebration(input: unknown): Promise<CelebrationDetail> {
  const { db, userId, isAdmin } = await requireViewer();
  const target = parse(targetSchema, input);

  const [canInteract, reactions, comments, directory, praises] = await Promise.all([
    canInteractWith(db, target),
    db
      .from("hr_celebration_reactions")
      .select("user_id, created_at")
      .eq("employee_id", target.employeeId)
      .eq("kind", target.kind)
      .eq("year", target.year)
      .order("created_at"),
    db
      .from("hr_celebration_comments")
      .select("id, user_id, body, mentions, created_at")
      .eq("employee_id", target.employeeId)
      .eq("kind", target.kind)
      .eq("year", target.year)
      .order("created_at", { ascending: false }),
    loadPeopleDirectory(db, LOG),
    db
      .from("hr_celebration_praises")
      .select("praise, user_id")
      .eq("employee_id", target.employeeId)
      .eq("kind", target.kind)
      .eq("year", target.year),
  ]);
  if (reactions.error || comments.error) {
    console.error(`[${LOG}] detalhe:`, reactions.error?.message ?? comments.error?.message);
    throw new CelebrationHttpError("Não foi possível carregar as felicitações.", 500);
  }

  const reactionRows = (reactions.data ?? []) as Array<{ user_id: string }>;
  const commentRows = (comments.data ?? []) as Array<{ id: string; user_id: string; body: string; mentions: string[] | null; created_at: string }>;
  const praiseRows = (praises.data ?? []) as Array<{ praise: string; user_id: string }>;
  const [users, commentLikes, ownEmployee] = await Promise.all([
    loadUsers(db, [
      ...new Set([...reactionRows.map((row) => row.user_id), ...commentRows.map((row) => row.user_id), ...praiseRows.map((row) => row.user_id)]),
    ]),
    commentRows.length > 0
      ? db.from("hr_celebration_comment_likes").select("comment_id, user_id").in("comment_id", commentRows.map((row) => row.id))
      : Promise.resolve({ data: [] as Array<{ comment_id: string; user_id: string }>, error: null }),
    db.from("hr_employees").select("id").eq("user_id", userId).eq("id", target.employeeId).maybeSingle(),
  ]);
  if (praises.error || commentLikes.error) console.error(`[${LOG}] elogios/curtidas:`, praises.error?.message ?? commentLikes.error?.message);
  const isOwn = Boolean(ownEmployee.data);
  const faceOf = (id: string) => {
    const user = users.get(id);
    return {
      name: shortName(user?.name).split(" ")[0],
      avatarUrl: awardPhotoUrl(resolveEmployeeAvatarUrl(user?.avatar_url, user?.photo_onedrive_url), 96),
    };
  };
  const likeRows = (commentLikes.data ?? []) as Array<{ comment_id: string; user_id: string }>;
  const people = directory.filter((person) => person.is_active);
  const personName = new Map(people.map((person) => [person.id, person.short_name]));

  return {
    likes: reactionRows.length,
    liked: reactionRows.some((row) => row.user_id === userId),
    likedBy: reactionRows.map((row) => shortName(users.get(row.user_id)?.name).split(" ")[0]),
    praises: CELEBRATION_PRAISES.map(({ key }) => ({
      key,
      count: praiseRows.filter((row) => row.praise === key).length,
      mine: praiseRows.some((row) => row.praise === key && row.user_id === userId),
      people: praiseRows.filter((row) => row.praise === key).slice(0, 6).map((row) => faceOf(row.user_id)),
    })),
    comments: commentRows.map<CelebrationComment>((row) => {
      const author = users.get(row.user_id);
      return {
        id: row.id,
        author: {
          name: shortName(author?.name),
          department: author?.department ?? null,
          avatarUrl: awardPhotoUrl(resolveEmployeeAvatarUrl(author?.avatar_url, author?.photo_onedrive_url), 96),
        },
        body: row.body,
        mentions: (row.mentions ?? []).flatMap((id) => (personName.has(id) ? [{ id, name: personName.get(id)! }] : [])),
        createdAt: row.created_at,
        likes: likeRows.filter((like) => like.comment_id === row.id).length,
        liked: likeRows.some((like) => like.comment_id === row.id && like.user_id === userId),
        canDelete: isAdmin || row.user_id === userId,
      };
    }),
    canInteract,
    isOwn,
    canShare: isOwn || isAdmin,
    people: people.map((person) => ({
      id: person.id,
      name: person.short_name,
      department: person.department,
      avatarUrl: awardPhotoUrl(person.avatar_url, 96),
    })),
  };
}

/** Curte ou descurte; devolve como ficou. */
export async function toggleCelebrationLike(input: unknown): Promise<{ likes: number; liked: boolean }> {
  const { db, userId } = await requireViewer();
  const target = parse(targetSchema, input);
  if (!(await canInteractWith(db, target))) {
    throw new CelebrationHttpError("Dá para parabenizar no dia e na semana seguinte.", 409);
  }
  const match = { employee_id: target.employeeId, kind: target.kind, year: target.year, user_id: userId };
  const { data: removed, error: removeError } = await db.from("hr_celebration_reactions").delete().match(match).select("user_id");
  if (removeError) throw new CelebrationHttpError("Não foi possível registrar a curtida.", 500);
  const liked = (removed ?? []).length === 0;
  if (liked) {
    const { error } = await db.from("hr_celebration_reactions").insert(match);
    if (error) {
      console.error(`[${LOG}] curtida:`, error.message);
      throw new CelebrationHttpError("Não foi possível registrar a curtida.", 500);
    }
  }
  const { count } = await db
    .from("hr_celebration_reactions")
    .select("user_id", { count: "exact", head: true })
    .eq("employee_id", target.employeeId)
    .eq("kind", target.kind)
    .eq("year", target.year);
  return { likes: count ?? 0, liked };
}

/** Dá ou tira um elogio (valor CIVIL) na comemoração. */
export async function toggleCelebrationPraise(input: unknown): Promise<{ mine: boolean }> {
  const { db, userId } = await requireViewer();
  const value = parse(targetSchema.extend({ praise: z.enum(CELEBRATION_PRAISE_KEYS, { message: "Elogio inválido." }) }), input);
  if (!(await canInteractWith(db, value))) {
    throw new CelebrationHttpError("Dá para elogiar no dia e na semana seguinte.", 409);
  }
  const match = { employee_id: value.employeeId, kind: value.kind, year: value.year, user_id: userId, praise: value.praise };
  const { data: removed, error: removeError } = await db.from("hr_celebration_praises").delete().match(match).select("user_id");
  if (removeError) throw new CelebrationHttpError("Não foi possível registrar o elogio.", 500);
  const mine = (removed ?? []).length === 0;
  if (mine) {
    const { error } = await db.from("hr_celebration_praises").insert(match);
    if (error) {
      console.error(`[${LOG}] elogio:`, error.message);
      throw new CelebrationHttpError("Não foi possível registrar o elogio.", 500);
    }
  }
  return { mine };
}

/** Curte ou descurte uma mensagem. */
export async function toggleCommentLike(input: unknown): Promise<{ liked: boolean }> {
  const { db, userId } = await requireViewer();
  const { id } = parse(z.object({ id: z.string().uuid("Mensagem inválida.") }), input);
  const { data: comment } = await db.from("hr_celebration_comments").select("id").eq("id", id).maybeSingle();
  if (!comment) throw new CelebrationHttpError("Mensagem não encontrada.", 404);
  const match = { comment_id: id, user_id: userId };
  const { data: removed, error: removeError } = await db.from("hr_celebration_comment_likes").delete().match(match).select("user_id");
  if (removeError) throw new CelebrationHttpError("Não foi possível registrar a curtida.", 500);
  const liked = (removed ?? []).length === 0;
  if (liked) {
    const { error } = await db.from("hr_celebration_comment_likes").insert(match);
    if (error) throw new CelebrationHttpError("Não foi possível registrar a curtida.", 500);
  }
  return { liked };
}

/** Publica um comentário (com as pessoas marcadas). */
export async function addCelebrationComment(input: unknown): Promise<{ id: string }> {
  const { db, userId } = await requireViewer();
  const value = parse(commentSchema, input);
  if (!(await canInteractWith(db, value))) {
    throw new CelebrationHttpError("Dá para comentar no dia e na semana seguinte.", 409);
  }
  let mentions = [...new Set(value.mentions)];
  if (mentions.length > 0) {
    const { data } = await db.from("hr_employees").select("id").in("id", mentions).eq("is_active", true);
    const valid = new Set((data ?? []).map((row) => row.id as string));
    mentions = mentions.filter((id) => valid.has(id));
  }
  const { data, error } = await db
    .from("hr_celebration_comments")
    .insert({ employee_id: value.employeeId, kind: value.kind, year: value.year, user_id: userId, body: value.body, mentions })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[${LOG}] comentário:`, error?.message);
    throw new CelebrationHttpError("Não foi possível publicar o comentário.", 500);
  }
  return { id: data.id as string };
}

/** Apaga um comentário: o autor ou um admin. */
export async function deleteCelebrationComment(input: unknown): Promise<void> {
  const { db, userId, isAdmin } = await requireViewer();
  const { id } = parse(z.object({ id: z.string().uuid("Comentário inválido.") }), input);
  const { data } = await db.from("hr_celebration_comments").select("user_id").eq("id", id).maybeSingle();
  if (!data) throw new CelebrationHttpError("Comentário não encontrado.", 404);
  if (!isAdmin && data.user_id !== userId) throw new CelebrationHttpError("Só quem escreveu pode apagar.", 403);
  const { error } = await db.from("hr_celebration_comments").delete().eq("id", id);
  if (error) throw new CelebrationHttpError("Não foi possível apagar o comentário.", 500);
}
