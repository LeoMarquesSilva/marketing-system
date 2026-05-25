import type { Area } from "./areas";
import type { InstagramPost } from "./instagram-posts";
import type { User } from "./users";

export interface BarChartItem {
  label: string;
  total: number;
  sublabel?: string;
}

export interface CollaboratorInsight {
  userId: string;
  name: string;
  avatar_url: string | null;
  department: string;
  posts: number;
  reach: number;
  views: number;
  interactions: number;
}

export interface AreaInsight {
  area: string;
  posts: number;
  reach: number;
  views: number;
  likes: number;
  interactions: number;
  avgInteractions: number;
  collaborators: CollaboratorInsight[];
}

function aggregatePostMetrics(posts: InstagramPost[]) {
  return posts.reduce(
    (acc, p) => ({
      posts: acc.posts + 1,
      reach: acc.reach + p.reach,
      views: acc.views + p.views,
      likes: acc.likes + p.likes,
      interactions: acc.interactions + p.total_interactions,
    }),
    { posts: 0, reach: 0, views: 0, likes: 0, interactions: 0 }
  );
}

export function computeInteractionsByArea(posts: InstagramPost[]): BarChartItem[] {
  const map = new Map<string, number>();
  for (const post of posts) {
    const key = post.area || "Sem área";
    map.set(key, (map.get(key) ?? 0) + post.total_interactions);
  }
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

export function computeInteractionsBySolicitante(
  posts: InstagramPost[],
  users: User[]
): BarChartItem[] {
  const map = new Map<string, { total: number; name: string }>();

  for (const post of posts) {
    if (!post.solicitante_id && !post.solicitante) continue;
    const key = post.solicitante_id ?? post.solicitante!;
    const user = post.solicitante_id
      ? users.find((u) => u.id === post.solicitante_id)
      : null;
    const name = user?.name ?? post.solicitante ?? "Desconhecido";
    const current = map.get(key) ?? { total: 0, name };
    map.set(key, { total: current.total + post.total_interactions, name });
  }

  return Array.from(map.values())
    .map(({ name, total }) => ({ label: name, total }))
    .sort((a, b) => b.total - a.total);
}

export function computeAreaDashboards(
  posts: InstagramPost[],
  areas: Area[],
  users: User[]
): AreaInsight[] {
  const areaNames = [
    ...areas.map((a) => a.name),
    ...new Set(
      posts.map((p) => p.area).filter((a): a is string => Boolean(a))
    ),
  ].filter((name, i, arr) => arr.indexOf(name) === i);

  return areaNames
    .map((areaName) => {
      const areaPosts = posts.filter((p) => p.area === areaName);
      const metrics = aggregatePostMetrics(areaPosts);

      const departmentUsers = users.filter((u) => u.department === areaName);
      const solicitanteIds = new Set(
        areaPosts.map((p) => p.solicitante_id).filter(Boolean) as string[]
      );

      const collaboratorIds = new Set([
        ...departmentUsers.map((u) => u.id),
        ...solicitanteIds,
      ]);

      const collaborators: CollaboratorInsight[] = Array.from(collaboratorIds)
        .map((userId) => {
          const user = users.find((u) => u.id === userId);
          if (!user) {
            const post = areaPosts.find((p) => p.solicitante_id === userId);
            return {
              userId,
              name: post?.solicitante ?? "Desconhecido",
              avatar_url: null,
              department: areaName,
              posts: 0,
              reach: 0,
              views: 0,
              interactions: 0,
            };
          }

          const userPosts = areaPosts.filter((p) => p.solicitante_id === userId);
          const userMetrics = aggregatePostMetrics(userPosts);

          return {
            userId: user.id,
            name: user.name,
            avatar_url: user.avatar_url,
            department: user.department,
            posts: userMetrics.posts,
            reach: userMetrics.reach,
            views: userMetrics.views,
            interactions: userMetrics.interactions,
          };
        })
        .sort((a, b) => b.interactions - a.interactions || b.posts - a.posts);

      return {
        area: areaName,
        posts: metrics.posts,
        reach: metrics.reach,
        views: metrics.views,
        likes: metrics.likes,
        interactions: metrics.interactions,
        avgInteractions:
          metrics.posts > 0 ? metrics.interactions / metrics.posts : 0,
        collaborators,
      };
    })
    .filter((a) => a.posts > 0 || a.collaborators.length > 0)
    .sort((a, b) => b.interactions - a.interactions);
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
