"use client";

import * as React from "react";
import { ArrowDownWideNarrow, CircleAlert, Grid3X3, History, Link2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterChip, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import {
  LINKEDIN_FORMAT_ICONS,
  LINKEDIN_FORMAT_LABELS,
  LinkedinPostCard,
  linkedinPostAreas,
  linkedinPostFormat,
  linkedinPostsInRange,
  type LinkedinMetricsUser,
  type LinkedinPostFormat,
} from "@/components/linkedin/linkedin-post-pieces";
import { getAreaIcon } from "@/lib/area-icons";
import { linkedinPostEngagementPercent } from "@/lib/linkedin-analytics";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import type { ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import type { LinkedinPost } from "@/lib/linkedin-types";

const PAGE_SIZE = 24;

export type LinkedinLinkFilter = "todos" | "vinculados" | "sem-vinculo";

type SortKey = "impressions" | "engagement" | "clicks" | "reactions" | "recent";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "impressions", label: "Impressões" },
  { value: "engagement", label: "Engajamento" },
  { value: "clicks", label: "Cliques" },
  { value: "reactions", label: "Reações" },
  { value: "recent", label: "Mais recentes" },
];

function metricFor(post: LinkedinPost, key: SortKey): { label: string; value: string } {
  switch (key) {
    case "engagement":
      return { label: "engajamento", value: formatPercent(linkedinPostEngagementPercent(post), 1) };
    case "clicks":
      return { label: "cliques", value: formatInt(post.clicks) };
    case "reactions":
      return { label: "reações", value: formatInt(post.likes) };
    default:
      return { label: "impressões", value: formatCompact(post.impressions) };
  }
}

function sortPosts(posts: LinkedinPost[], key: SortKey): LinkedinPost[] {
  const value = (post: LinkedinPost): number => {
    switch (key) {
      case "engagement":
        return post.engagement_rate;
      case "clicks":
        return post.clicks;
      case "reactions":
        return post.likes;
      case "recent":
        return post.published_at ? Date.parse(post.published_at) : 0;
      default:
        return post.impressions;
    }
  };
  return [...posts].sort((a, b) => value(b) - value(a) || b.impressions - a.impressions);
}

export function LinkedinPostsTab({
  period,
  posts,
  users,
  linkFilter,
  onLinkFilterChange,
  onOpenPost,
}: {
  period: ResolvedMetricsPeriod;
  posts: LinkedinPost[];
  users: LinkedinMetricsUser[];
  linkFilter: LinkedinLinkFilter;
  onLinkFilterChange: (next: LinkedinLinkFilter) => void;
  onOpenPost: (post: LinkedinPost) => void;
}) {
  const [allTime, setAllTime] = React.useState(false);
  const [format, setFormat] = React.useState<LinkedinPostFormat | "todos">("todos");
  const [area, setArea] = React.useState<string>("todas");
  const [sort, setSort] = React.useState<SortKey>("impressions");
  const [query, setQuery] = React.useState("");
  const [visible, setVisible] = React.useState(PAGE_SIZE);

  const scoped = React.useMemo(() => (allTime ? posts : linkedinPostsInRange(posts, period.from, period.to)), [allTime, posts, period.from, period.to]);
  const areas = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of scoped) for (const name of linkedinPostAreas(post)) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [scoped]);
  const linkedCount = scoped.filter((post) => post.instagram_post_id).length;
  const pendingCount = scoped.length - linkedCount;

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return sortPosts(
      scoped.filter((post) => {
        if (linkFilter === "vinculados" && !post.instagram_post_id) return false;
        if (linkFilter === "sem-vinculo" && post.instagram_post_id) return false;
        if (format !== "todos" && linkedinPostFormat(post) !== format) return false;
        if (area !== "todas" && !linkedinPostAreas(post).includes(area)) return false;
        if (needle && ![post.caption, post.byline, post.published_by].some((value) => value?.toLocaleLowerCase("pt-BR").includes(needle))) return false;
        return true;
      }),
      sort
    );
  }, [scoped, linkFilter, format, area, query, sort]);

  React.useEffect(() => setVisible(PAGE_SIZE), [format, area, query, sort, allTime, linkFilter, period.from, period.to]);

  return (
    <MetricsSection
      title={allTime ? "Todas as publicações importadas" : "Publicações do período"}
      icon={Grid3X3}
      description={`${filtered.length} de ${scoped.length} publicações. Clique para ver os números e vincular ao post do Instagram (capa, área e autores).`}
      action={
        <FilterChip selected={allTime} onClick={() => setAllTime((value) => !value)} icon={History}>
          Todo o histórico
        </FilterChip>
      }
    >
      <div className="space-y-3 border-b border-[#edf3f5] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar no texto ou no autor"
              className="pl-9"
              aria-label="Buscar no texto ou no autor"
            />
          </div>
          <FilterChip selected={linkFilter === "todos"} onClick={() => onLinkFilterChange("todos")}>
            Todas
          </FilterChip>
          <FilterChip selected={linkFilter === "vinculados"} onClick={() => onLinkFilterChange("vinculados")} icon={Link2} count={linkedCount}>
            Com post do Instagram
          </FilterChip>
          <FilterChip selected={linkFilter === "sem-vinculo"} onClick={() => onLinkFilterChange("sem-vinculo")} icon={CircleAlert} count={pendingCount}>
            Sem vínculo
          </FilterChip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip selected={format === "todos"} onClick={() => setFormat("todos")}>
            Todos os formatos
          </FilterChip>
          {(["video", "carrossel", "imagem"] as LinkedinPostFormat[]).map((item) => (
            <FilterChip key={item} selected={format === item} onClick={() => setFormat(item)} icon={LINKEDIN_FORMAT_ICONS[item]}>
              {LINKEDIN_FORMAT_LABELS[item]}
            </FilterChip>
          ))}
        </div>
        {areas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip selected={area === "todas"} onClick={() => setArea("todas")}>
              Todas as áreas
            </FilterChip>
            {areas.map(([name, count]) => (
              <FilterChip key={name} selected={area === name} onClick={() => setArea(name)} icon={getAreaIcon(name)} count={count}>
                {name}
              </FilterChip>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownWideNarrow className="size-3.5" aria-hidden />
            Ordenar por
          </span>
          {SORT_OPTIONS.map((option) => (
            <FilterChip key={option.value} selected={sort === option.value} onClick={() => setSort(option.value)}>
              {option.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="pt-4">
          <MetricsEmpty
            icon={Grid3X3}
            title={scoped.length === 0 ? "Nenhuma publicação no período" : "Nenhuma publicação com esses filtros"}
            description={scoped.length === 0 ? "Ligue “Todo o histórico” ou importe a planilha de Conteúdo mais recente." : "Troque o período ou limpe os filtros."}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filtered.slice(0, visible).map((post) => {
              const metric = metricFor(post, sort);
              return (
                <LinkedinPostCard key={post.id} post={post} users={users} metricLabel={metric.label} metricValue={metric.value} onOpen={() => onOpenPost(post)} />
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
