"use client";

import * as React from "react";
import { ArrowDownWideNarrow, CircleAlert, Grid3X3, History, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterChip, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { FORMAT_ICONS, PostCard } from "@/components/instagram/metrics/instagram-post-pieces";
import { getAreaIcon } from "@/lib/area-icons";
import { computePostEngagementRate } from "@/lib/instagram-engagement";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import type { ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import {
  POST_FORMAT_LABELS,
  POST_SORT_OPTIONS,
  postFormat,
  postsInRange,
  sortPosts,
  type PostFormat,
  type PostSortKey,
} from "@/lib/social-metrics/instagram";
import type { InstagramPost } from "@/lib/instagram-posts";
import type { User } from "@/lib/users";

const PAGE_SIZE = 24;

function metricFor(post: InstagramPost, key: PostSortKey): { label: string; value: string } {
  switch (key) {
    case "views": return { label: "visualizações", value: formatCompact(post.views) };
    case "saves": return { label: "salvamentos", value: formatInt(post.saves) };
    case "shares": return { label: "compartilhamentos", value: formatInt(post.shares) };
    case "follows": return { label: "seguidores", value: formatInt(post.follows) };
    case "engagement": return { label: "engajamento", value: formatPercent(computePostEngagementRate(post), 1) };
    default: return { label: "alcance", value: formatCompact(post.reach) };
  }
}

export function InstagramContentTab({
  period,
  posts,
  users,
  onOpenPost,
}: {
  period: ResolvedMetricsPeriod;
  posts: InstagramPost[];
  users: User[];
  onOpenPost: (post: InstagramPost) => void;
}) {
  const [allTime, setAllTime] = React.useState(false);
  const [format, setFormat] = React.useState<PostFormat | "todos">("todos");
  const [area, setArea] = React.useState<string>("todas");
  const [sort, setSort] = React.useState<PostSortKey>("reach");
  const [query, setQuery] = React.useState("");
  const [visible, setVisible] = React.useState(PAGE_SIZE);

  const scoped = React.useMemo(() => (allTime ? posts : postsInRange(posts, period.from, period.to)), [allTime, posts, period.from, period.to]);
  const areas = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of scoped) for (const name of new Set(post.areas)) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [scoped]);
  const withoutArea = scoped.filter((post) => post.areas.length === 0).length;

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortPosts(
      scoped.filter((post) => {
        if (format !== "todos" && postFormat(post) !== format) return false;
        if (area === "sem-area" && post.areas.length > 0) return false;
        if (area !== "todas" && area !== "sem-area" && !post.areas.includes(area)) return false;
        if (needle && !(post.caption ?? "").toLowerCase().includes(needle)) return false;
        return true;
      }),
      sort
    );
  }, [scoped, format, area, query, sort]);

  React.useEffect(() => setVisible(PAGE_SIZE), [format, area, query, sort, allTime, period.from, period.to]);

  return (
    <MetricsSection
      title={allTime ? "Todos os posts desde 2025" : "Posts publicados no período"}
      icon={Grid3X3}
      description={`${filtered.length} de ${scoped.length} posts. Clique para ver os números e ajustar área e autores.`}
      action={
        <FilterChip selected={allTime} onClick={() => setAllTime((value) => !value)} icon={History}>
          Todo o histórico
        </FilterChip>
      }
    >
      <div className="space-y-3 border-b border-[#edf3f5] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na legenda" className="pl-9" aria-label="Buscar na legenda" />
          </div>
          <FilterChip selected={format === "todos"} onClick={() => setFormat("todos")}>
            Todos os formatos
          </FilterChip>
          {(["reels", "carrossel", "imagem"] as PostFormat[]).map((item) => (
            <FilterChip key={item} selected={format === item} onClick={() => setFormat(item)} icon={FORMAT_ICONS[item]}>
              {POST_FORMAT_LABELS[item]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip selected={area === "todas"} onClick={() => setArea("todas")}>
            Todas as áreas
          </FilterChip>
          {areas.map(([name, count]) => (
            <FilterChip key={name} selected={area === name} onClick={() => setArea(name)} icon={getAreaIcon(name)} count={count}>
              {name}
            </FilterChip>
          ))}
          {withoutArea > 0 && (
            <FilterChip selected={area === "sem-area"} onClick={() => setArea("sem-area")} icon={CircleAlert} count={withoutArea}>
              Sem área
            </FilterChip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownWideNarrow className="size-3.5" aria-hidden />
            Ordenar por
          </span>
          {POST_SORT_OPTIONS.map((option) => (
            <FilterChip key={option.value} selected={sort === option.value} onClick={() => setSort(option.value)}>
              {option.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="pt-4">
          <MetricsEmpty icon={Grid3X3} title="Nenhum post com esses filtros" description="Troque o período ou limpe os filtros." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filtered.slice(0, visible).map((post) => {
              const metric = metricFor(post, sort);
              return (
                <PostCard key={post.id} post={post} users={users} metricLabel={metric.label} metricValue={metric.value} onOpen={() => onOpenPost(post)} />
              );
            })}
          </div>
          {visible < filtered.length && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setVisible((value) => value + PAGE_SIZE)}>
                Mostrar mais ({filtered.length - visible})
              </Button>
            </div>
          )}
        </>
      )}
    </MetricsSection>
  );
}
