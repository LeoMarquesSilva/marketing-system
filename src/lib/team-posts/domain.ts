import {
  normalizeScheduleArea,
  resolveContentScheduleAccess,
  type ContentScheduleAccessInput,
} from "@/lib/content-schedule/domain";
import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import {
  computeEngagementActionsFromPost,
  computeEngagementRate,
  computePostEngagementRate,
} from "@/lib/instagram-engagement";
import { getPostAreas, getPostSolicitantes } from "@/lib/instagram-link-rules";
import type { InstagramPost } from "@/lib/instagram-posts";

/** Permissão de quem já vê o Instagram Insights completo. */
const INSTAGRAM_INSIGHTS_KEY = "/instagram-insights";

/** Áreas que não formam equipe (posts de marca, sem autor obrigatório). */
const NON_TEAM_AREA_KEYS = new Set(["institucional"]);

export type TeamPostsAccessInput = Omit<ContentScheduleAccessInput, "userId">;

export interface TeamPostsAccess {
  allowed: boolean;
  /** `null` = todas as áreas; lista = áreas lideradas (rótulo canônico). */
  areas: string[] | null;
}

/**
 * Quem vê as postagens da equipe: Marketing e quem já tem o Instagram Insights
 * veem todas as áreas; coordenadores, gestores e sócios veem as áreas que
 * lideram, pelo mesmo mapeamento de liderança do Calendário editorial e de
 * Férias (cargo + área no RH, ou escopo personalizado em Usuários).
 */
export function resolveTeamPostsAccess(input: TeamPostsAccessInput): TeamPostsAccess {
  if (!input.isActive) return { allowed: false, areas: [] };
  if (input.permissions?.includes(INSTAGRAM_INSIGHTS_KEY)) return { allowed: true, areas: null };

  const schedule = resolveContentScheduleAccess({ ...input, userId: "" });
  if (schedule.manageAll || schedule.manageableAreas === null) {
    return { allowed: true, areas: null };
  }
  return schedule.manageableAreas.length > 0
    ? { allowed: true, areas: schedule.manageableAreas }
    : { allowed: false, areas: [] };
}

/**
 * Chave de comparação entre a área do post e o departamento do colaborador:
 * aplica o agrupamento oficial (Insolvência → Reestruturação, Marketing →
 * Operações Legais…) e o vocabulário de conteúdo (Distressed Deals).
 */
export function teamAreaKey(value: string | null | undefined): string | null {
  const canonical = resolveCanonicalAreaLabel(value);
  return canonical ? normalizeScheduleArea(canonical) : null;
}

export interface TeamPerson {
  id: string;
  name: string;
  avatar_url: string | null;
  /** Área canônica do colaborador (RH, com fallback no cadastro de usuário). */
  area: string;
}

export interface TeamAreaOption {
  key: string;
  label: string;
}

/** Áreas que a pessoa pode filtrar, na ordem alfabética. */
export function resolveTeamAreaOptions(
  access: TeamPostsAccess,
  candidates: Array<string | null | undefined>
): TeamAreaOption[] {
  const source = access.areas ?? candidates;
  const options = new Map<string, string>();
  for (const value of source) {
    const key = teamAreaKey(value);
    if (!key || NON_TEAM_AREA_KEYS.has(key) || options.has(key)) continue;
    options.set(key, resolveCanonicalAreaLabel(value) ?? key);
  }
  return [...options.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function personInAreas(person: Pick<TeamPerson, "area">, areaKeys: ReadonlySet<string>): boolean {
  const key = teamAreaKey(person.area);
  return key !== null && areaKeys.has(key);
}

/**
 * Posts da equipe: marcados com uma das áreas ou com algum autor da equipe
 * (cobre collab com outra área). `areaKeys = null` devolve tudo.
 */
export function scopeTeamPosts(
  posts: InstagramPost[],
  areaKeys: ReadonlySet<string> | null,
  memberIds: ReadonlySet<string>
): InstagramPost[] {
  if (areaKeys === null) return posts;
  return posts.filter(
    (post) =>
      getPostAreas(post).some((area) => {
        const key = teamAreaKey(area);
        return key !== null && areaKeys.has(key);
      }) || getPostSolicitantes(post).some((author) => memberIds.has(author.id))
  );
}

export interface TeamMemberStats extends TeamPerson {
  posts: number;
  reels: number;
  reach: number;
  views: number;
  engagementActions: number;
  /** (curtidas + comentários + salvamentos) ÷ alcance × 100. */
  engagementRate: number;
  lastPostAt: string | null;
}

/** Uma linha por integrante, inclusive quem não publicou no recorte. */
export function computeTeamMemberStats(
  posts: InstagramPost[],
  members: TeamPerson[]
): TeamMemberStats[] {
  const stats = new Map<string, TeamMemberStats & { likes: number; comments: number; saves: number }>(
    members.map((member) => [
      member.id,
      {
        ...member,
        posts: 0,
        reels: 0,
        reach: 0,
        views: 0,
        engagementActions: 0,
        engagementRate: 0,
        lastPostAt: null,
        likes: 0,
        comments: 0,
        saves: 0,
      },
    ])
  );

  for (const post of posts) {
    const authorIds = new Set(getPostSolicitantes(post).map((author) => author.id));
    for (const id of authorIds) {
      const row = stats.get(id);
      if (!row) continue;
      row.posts += 1;
      if (post.media_type === "VIDEO") row.reels += 1;
      row.reach += post.reach;
      row.views += post.views;
      row.likes += post.likes;
      row.comments += post.comments;
      row.saves += post.saves;
      row.engagementActions += computeEngagementActionsFromPost(post);
      if (post.published_at && (!row.lastPostAt || post.published_at > row.lastPostAt)) {
        row.lastPostAt = post.published_at;
      }
    }
  }

  return [...stats.values()]
    .map(({ likes, comments, saves, ...row }) => ({
      ...row,
      engagementRate: computeEngagementRate(likes, comments, saves, row.reach),
    }))
    .sort(
      (a, b) =>
        b.posts - a.posts ||
        b.engagementActions - a.engagementActions ||
        a.name.localeCompare(b.name, "pt-BR")
    );
}

/** Mídias pré-selecionadas para o slide: as de maior taxa de engajamento. */
export function pickSlideMediaIds(posts: InstagramPost[], count = 3): string[] {
  return [...posts]
    .filter((post) => post.reach > 0)
    .sort((a, b) => computePostEngagementRate(b) - computePostEngagementRate(a))
    .slice(0, count)
    .map((post) => post.id);
}

/** Mídias escolhidas na ordem do slide (cronológica). */
export function orderSlideMedia(posts: InstagramPost[], ids: readonly string[]): InstagramPost[] {
  const selected = new Set(ids);
  return posts
    .filter((post) => selected.has(post.id))
    .sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""));
}
