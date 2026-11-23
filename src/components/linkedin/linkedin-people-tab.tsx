"use client";

import * as React from "react";
import { ArrowDownWideNarrow, CircleAlert, Shapes, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FilterChip, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { CHART_COLORS } from "@/components/social-metrics/metrics-charts";
import { linkedinPostAreas, linkedinPostPeople, type LinkedinMetricsUser } from "@/components/linkedin/linkedin-post-pieces";
import { getAreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { getLinkedinPostActions } from "@/lib/linkedin-analytics";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import type { LinkedinPost } from "@/lib/linkedin-types";

type SortKey = "rate" | "impressions" | "posts";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "rate", label: "Engajamento" },
  { value: "impressions", label: "Impressões" },
  { value: "posts", label: "Publicações" },
];

interface GroupRow {
  key: string;
  label: string;
  avatarUrl: string | null;
  posts: number;
  impressions: number;
  actions: number;
  rate: number | null;
}

function groupPosts(posts: LinkedinPost[], keys: (post: LinkedinPost) => { key: string; label: string; avatarUrl: string | null }[]): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const post of posts) {
    for (const item of keys(post)) {
      const row = map.get(item.key) ?? { ...item, posts: 0, impressions: 0, actions: 0, rate: null };
      row.posts += 1;
      row.impressions += post.impressions;
      row.actions += getLinkedinPostActions(post);
      map.set(item.key, row);
    }
  }
  return [...map.values()].map((row) => ({ ...row, rate: row.impressions > 0 ? (row.actions / row.impressions) * 100 : null }));
}

function sortRows(rows: GroupRow[], key: SortKey): GroupRow[] {
  const value = (row: GroupRow) => (key === "rate" ? row.rate ?? -1 : key === "impressions" ? row.impressions : row.posts);
  return [...rows].sort((a, b) => value(b) - value(a) || b.impressions - a.impressions);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function RankList({ rows, sort, kind }: { rows: GroupRow[]; sort: SortKey; kind: "area" | "author" }) {
  const max = Math.max(1, ...rows.map((row) => (sort === "rate" ? row.rate ?? 0 : sort === "impressions" ? row.impressions : row.posts)));
  return (
    <ol className="-mx-2 divide-y divide-[#edf3f5]">
      {rows.map((row, index) => {
        const value = sort === "rate" ? row.rate ?? 0 : sort === "impressions" ? row.impressions : row.posts;
        const Icon = getAreaIcon(row.label);
        return (
          <li key={row.key} className="flex items-center gap-3 px-2 py-2.5">
            <span className="w-5 shrink-0 text-center font-mono text-sm font-semibold text-[#6b8591]">{index + 1}</span>
            {kind === "area" ? (
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", getAreaIconStyle(row.label))}>
                <Icon className="size-4" aria-hidden />
              </span>
            ) : (
              <Avatar className="size-9 ring-1 ring-[#dce9eb]">
                {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt="" />}
                <AvatarFallback className="bg-[#e8f1f5] text-xs font-semibold text-[#315f73]">{initials(row.label)}</AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-[#10232d]">{row.label}</p>
                <p className="shrink-0 font-mono text-sm font-semibold text-[#10232d]">
                  {sort === "rate" ? formatPercent(row.rate, 2) : sort === "impressions" ? formatCompact(row.impressions) : formatInt(row.posts)}
                </p>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[#eef3f5]">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: kind === "area" ? CHART_COLORS.blue : CHART_COLORS.purple }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatInt(row.posts)} {row.posts === 1 ? "publicação" : "publicações"} · {formatCompact(row.impressions)} impressões ·{" "}
                {formatPercent(row.rate, 1)} de engajamento
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function LinkedinPeopleTab({
  posts,
  users,
  onShowPending,
}: {
  posts: LinkedinPost[];
  users: LinkedinMetricsUser[];
  onShowPending: () => void;
}) {
  const [sort, setSort] = React.useState<SortKey>("rate");
  const areas = React.useMemo(
    () => sortRows(groupPosts(posts, (post) => linkedinPostAreas(post).map((area) => ({ key: area, label: area, avatarUrl: null }))), sort),
    [posts, sort]
  );
  const authors = React.useMemo(
    () =>
      sortRows(
        groupPosts(posts, (post) => linkedinPostPeople(post, users).map((person) => ({ key: person.name, label: person.name, avatarUrl: person.avatar_url }))),
        sort
      ),
    [posts, users, sort]
  );
  const pending = posts.filter((post) => !post.instagram_post_id).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dce9eb] bg-white px-4 py-3">
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
        {pending > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8a5a12]">
            <CircleAlert className="size-4" aria-hidden />
            {pending} de {posts.length} publicações do período sem post do Instagram vinculado ficam fora das áreas.
            <Button variant="outline" size="xs" onClick={onShowPending}>
              Vincular agora
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <MetricsSection title="Áreas" icon={Shapes} description="Área do post do Instagram vinculado. Uma publicação com duas áreas conta nas duas.">
          {areas.length ? (
            <RankList rows={areas} sort={sort} kind="area" />
          ) : (
            <MetricsEmpty icon={Shapes} title="Nenhuma área no período" description="Vincule as publicações ao post do Instagram para herdar a área." />
          )}
        </MetricsSection>
        <MetricsSection title="Autores" icon={UsersRound} description="Autores do post do Instagram vinculado; sem vínculo, o nome assinado no texto.">
          {authors.length ? (
            <RankList rows={authors} sort={sort} kind="author" />
          ) : (
            <MetricsEmpty icon={UsersRound} title="Nenhum autor identificado no período" />
          )}
        </MetricsSection>
      </div>
      <p className="text-xs text-muted-foreground">
        Engajamento = (cliques + reações + comentários + compartilhamentos + seguidores ganhos) ÷ impressões das publicações do grupo.
      </p>
    </div>
  );
}
