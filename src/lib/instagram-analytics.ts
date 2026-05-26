import type { Area } from "./areas";
import type { InstagramPost } from "./instagram-posts";
import type { User } from "./users";
import { computeEngagementActionsFromPost } from "./instagram-engagement";
import { getPostAreas, getPostSolicitantes } from "./instagram-link-rules";
import { isUserActive } from "./user-status";

export interface BarChartItem {
  label: string;
  total: number;
  sublabel?: string;
  isFormerEmployee?: boolean;
}

export interface CollaboratorInsight {
  userId: string;
  name: string;
  avatar_url: string | null;
  department: string;
  is_active: boolean;
  posts: number;
  reach: number;
  views: number;
  engagementActions: number;
}

export interface AreaInsight {
  area: string;
  posts: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  engagementActions: number;
  avgEngagementActions: number;
  collaborators: CollaboratorInsight[];
}

function aggregatePostMetrics(posts: InstagramPost[]) {
  return posts.reduce(
    (acc, p) => ({
      posts: acc.posts + 1,
      reach: acc.reach + p.reach,
      views: acc.views + p.views,
      likes: acc.likes + p.likes,
      comments: acc.comments + p.comments,
      saves: acc.saves + p.saves,
      engagementActions: acc.engagementActions + computeEngagementActionsFromPost(p),
    }),
    { posts: 0, reach: 0, views: 0, likes: 0, comments: 0, saves: 0, engagementActions: 0 }
  );
}

export function computeOfficeInsight(posts: InstagramPost[]) {
  const metrics = aggregatePostMetrics(posts);
  return {
    ...metrics,
    avgEngagementActions:
      metrics.posts > 0 ? metrics.engagementActions / metrics.posts : 0,
  };
}

export function computeTopPostsByEngagement(
  posts: InstagramPost[],
  limit = 5
): InstagramPost[] {
  return [...posts]
    .sort(
      (a, b) =>
        computeEngagementActionsFromPost(b) - computeEngagementActionsFromPost(a)
    )
    .slice(0, limit);
}

export function computeEngagementActionsByArea(posts: InstagramPost[]): BarChartItem[] {
  const map = new Map<string, number>();
  for (const post of posts) {
    const actions = computeEngagementActionsFromPost(post);
    const areas = getPostAreas(post);
    if (areas.length === 0) {
      map.set("Sem área", (map.get("Sem área") ?? 0) + actions);
      continue;
    }
    for (const area of areas) {
      map.set(area, (map.get(area) ?? 0) + actions);
    }
  }
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

/** @deprecated use computeEngagementActionsByArea */
export const computeInteractionsByArea = computeEngagementActionsByArea;

export function computeEngagementActionsBySolicitante(
  posts: InstagramPost[],
  users: User[]
): BarChartItem[] {
  const map = new Map<string, { total: number; name: string; isFormerEmployee: boolean }>();

  for (const post of posts) {
    const solicitantes = getPostSolicitantes(post);
    if (solicitantes.length === 0) continue;
    const actions = computeEngagementActionsFromPost(post);

    for (const solicitante of solicitantes) {
      const user = users.find((u) => u.id === solicitante.id);
      const name = user?.name ?? solicitante.name ?? "Desconhecido";
      const isFormerEmployee = user ? !isUserActive(user) : false;
      const current = map.get(solicitante.id) ?? { total: 0, name, isFormerEmployee };
      map.set(solicitante.id, {
        total: current.total + actions,
        name,
        isFormerEmployee: current.isFormerEmployee || isFormerEmployee,
      });
    }
  }

  return Array.from(map.values())
    .map(({ name, total, isFormerEmployee }) => ({
      label: name,
      total,
      sublabel: isFormerEmployee ? "Ex-funcionário" : undefined,
      isFormerEmployee,
    }))
    .sort((a, b) => b.total - a.total);
}

/** @deprecated use computeEngagementActionsBySolicitante */
export const computeInteractionsBySolicitante = computeEngagementActionsBySolicitante;

export function computeAreaDashboards(
  posts: InstagramPost[],
  areas: Area[],
  users: User[]
): AreaInsight[] {
  const areaNames = [
    ...areas.map((a) => a.name),
    ...new Set(posts.flatMap((p) => getPostAreas(p))),
  ].filter((name, i, arr) => arr.indexOf(name) === i);

  return areaNames
    .map((areaName) => {
      const areaPosts = posts.filter((p) => getPostAreas(p).includes(areaName));
      const metrics = aggregatePostMetrics(areaPosts);

      const departmentUsers = users.filter(
        (u) => u.department === areaName && isUserActive(u)
      );
      const solicitanteIds = new Set<string>();
      for (const post of areaPosts) {
        for (const s of getPostSolicitantes(post)) {
          solicitanteIds.add(s.id);
        }
      }

      const collaboratorIds = new Set([
        ...departmentUsers.map((u) => u.id),
        ...solicitanteIds,
      ]);

      const collaborators: CollaboratorInsight[] = Array.from(collaboratorIds)
        .map((userId) => {
          const user = users.find((u) => u.id === userId);
          if (!user) {
            const post = areaPosts.find((p) =>
              getPostSolicitantes(p).some((s) => s.id === userId)
            );
            const fallback = post
              ? getPostSolicitantes(post).find((s) => s.id === userId)
              : null;
            return {
              userId,
              name: fallback?.name ?? "Desconhecido",
              avatar_url: null,
              department: areaName,
              is_active: false,
              posts: 0,
              reach: 0,
              views: 0,
              engagementActions: 0,
            };
          }

          const userPosts = areaPosts.filter((p) =>
            getPostSolicitantes(p).some((s) => s.id === userId)
          );
          const userMetrics = aggregatePostMetrics(userPosts);

          return {
            userId: user.id,
            name: user.name,
            avatar_url: user.avatar_url,
            department: user.department,
            is_active: isUserActive(user),
            posts: userMetrics.posts,
            reach: userMetrics.reach,
            views: userMetrics.views,
            engagementActions: userMetrics.engagementActions,
          };
        })
        .filter((c) => c.posts > 0 || c.is_active)
        .sort(
          (a, b) =>
            Number(b.is_active) - Number(a.is_active) ||
            b.engagementActions - a.engagementActions ||
            b.posts - a.posts
        );

      return {
        area: areaName,
        posts: metrics.posts,
        reach: metrics.reach,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        saves: metrics.saves,
        engagementActions: metrics.engagementActions,
        avgEngagementActions:
          metrics.posts > 0 ? metrics.engagementActions / metrics.posts : 0,
        collaborators,
      };
    })
    .filter((a) => a.posts > 0 || a.collaborators.length > 0)
    .sort((a, b) => b.engagementActions - a.engagementActions);
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  return {
    items: items.slice(start, end),
    page: safePage,
    pageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : start + 1,
    end,
  };
}
