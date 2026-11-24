"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleUserRound, Grid3X3, LayoutDashboard, Loader2, RefreshCw, Shapes, Swords, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FreshnessBadge } from "@/components/social-metrics/metrics-ui";
import { MetricsPeriodBar, useMetricsPeriod } from "@/components/social-metrics/metrics-period-bar";
import { InstagramReportExport } from "@/components/instagram/instagram-report-export";
import { InstagramAreaDashboard } from "@/components/instagram/instagram-area-dashboard";
import type { PostLinkPatch } from "@/components/instagram/instagram-post-link-editor";
import { PostDetailDialog } from "@/components/instagram/metrics/instagram-post-pieces";
import { InstagramOverviewTab } from "@/components/instagram/metrics/instagram-overview-tab";
import { InstagramContentTab } from "@/components/instagram/metrics/instagram-content-tab";
import { InstagramStoriesTab } from "@/components/instagram/metrics/instagram-stories-tab";
import { InstagramAudienceTab } from "@/components/instagram/metrics/instagram-audience-tab";
import { InstagramCompetitorsTab } from "@/components/instagram/metrics/instagram-competitors-tab";
import { formatInt, formatSigned } from "@/lib/social-metrics/format";
import { addDays } from "@/lib/social-metrics/period";
import { computeInstagramKpis, postsEngagementRate, postsInRange } from "@/lib/social-metrics/instagram";
import type { InstagramMetricsData } from "@/lib/social-metrics/server";
import type { InstagramPost } from "@/lib/instagram-posts";

type TabKey = "visao" | "conteudo" | "stories" | "audiencia" | "areas" | "concorrentes";

const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "visao", label: "Visão geral", icon: LayoutDashboard },
  { key: "conteudo", label: "Conteúdo", icon: Grid3X3 },
  { key: "stories", label: "Stories", icon: CircleUserRound },
  { key: "audiencia", label: "Audiência", icon: UsersRound },
  { key: "areas", label: "Áreas", icon: Shapes },
  { key: "concorrentes", label: "Concorrentes", icon: Swords },
];

function toDateRange(from: string, to: string) {
  return { from: new Date(`${from}T00:00:00-03:00`), to: new Date(`${addDays(to, 1)}T00:00:00-03:00`) };
}

export function InstagramMetricsClient({ data }: { data: InstagramMetricsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, period, setState } = useMetricsPeriod();
  const tab = (TABS.find((item) => item.key === searchParams.get("aba"))?.key ?? "visao") as TabKey;

  const [posts, setPosts] = React.useState(data.posts);
  React.useEffect(() => setPosts(data.posts), [data.posts]);
  const [openPost, setOpenPost] = React.useState<InstagramPost | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [monthlyGoal, setMonthlyGoal] = React.useState(data.monthlyGoal);
  const goalSave = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Meta mensal de posts: muda na hora e salva meio segundo depois do último clique.
  const changeMonthlyGoal = (goal: number) => {
    const safe = Math.max(1, Math.floor(goal));
    setMonthlyGoal(safe);
    if (goalSave.current) clearTimeout(goalSave.current);
    goalSave.current = setTimeout(() => {
      void fetch("/api/instagram/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyGoal: safe }),
      }).then((res) => {
        if (!res.ok) setNotice({ tone: "error", text: "Não foi possível salvar a meta mensal." });
      });
    }, 500);
  };
  const [notice, setNotice] = React.useState<{ tone: "ok" | "warning" | "error"; text: string } | null>(null);

  const setTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "visao") params.delete("aba");
    else params.set("aba", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/instagram/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao atualizar");
      setNotice(
        json.warnings?.length
          ? { tone: "warning", text: `Atualizado com aviso: ${json.warnings[0]}` }
          : { tone: "ok", text: `Instagram atualizado: ${json.postsSynced} posts e ${json.daysSynced} dias da conta.` }
      );
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Erro ao atualizar o Instagram" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async (post: InstagramPost, patch: PostLinkPatch) => {
    setSavingId(post.id);
    try {
      const res = await fetch(`/api/instagram/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      const primary = patch.solicitantes[0];
      const update = (item: InstagramPost): InstagramPost =>
        item.id !== post.id
          ? item
          : {
              ...item,
              areas: patch.areas,
              area: patch.areas[0] ?? null,
              solicitantes: patch.solicitantes,
              solicitante_id: primary?.id ?? null,
              solicitante: primary?.name ?? null,
              skip_participants: patch.skip_participants ?? item.skip_participants,
            };
      setPosts((prev) => prev.map(update));
      setOpenPost((prev) => (prev ? update(prev) : prev));
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Erro ao salvar o vínculo" });
    } finally {
      setSavingId(null);
    }
  };

  const account = data.accountStats;
  const kpis = React.useMemo(() => computeInstagramKpis(data.insights, posts, period.from, period.to), [data.insights, posts, period.from, period.to]);
  const periodPosts = React.useMemo(() => postsInRange(posts, period.from, period.to), [posts, period.from, period.to]);
  const averageRate = postsEngagementRate(periodPosts);
  const pendingLinks = periodPosts.filter((post) => post.areas.length === 0).length;

  return (
    <div className="flex min-h-0 w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="rounded-full bg-gradient-to-tr from-[#c47f2a] via-[#c2557a] to-[#7466b4] p-[2px]">
            <Avatar className="size-14 border-2 border-white">
              {account?.profile_picture_url && <AvatarImage src={account.profile_picture_url} alt="" />}
              <AvatarFallback className="bg-[#04202f] font-semibold text-white">BP</AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-[#10232d]">{account?.name ?? "Bismarchi | Pires"}</p>
            <p className="text-sm text-muted-foreground">@{account?.username ?? "bismarchipires"}</p>
          </div>
          <dl className="hidden items-stretch gap-0 divide-x divide-[#dce9eb] rounded-lg border border-[#dce9eb] bg-white md:flex">
            <div className="px-4 py-2">
              <dt className="text-xs text-muted-foreground">Seguidores</dt>
              <dd className="font-mono text-base font-semibold text-[#10232d]">{formatInt(account?.followers_count)}</dd>
            </div>
            <div className="px-4 py-2">
              <dt className="text-xs text-muted-foreground">Saldo no período</dt>
              <dd className={cn("font-mono text-base font-semibold", (kpis.netFollowers ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {formatSigned(kpis.netFollowers)}
              </dd>
            </div>
            <div className="px-4 py-2">
              <dt className="text-xs text-muted-foreground">Posts no total</dt>
              <dd className="font-mono text-base font-semibold text-[#10232d]">{formatInt(account?.media_count)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <MetricsPeriodBar
        state={state}
        period={period}
        onChange={setState}
        right={
          <>
            <FreshnessBadge freshness={data.freshness} />
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {syncing ? "Atualizando…" : "Atualizar agora"}
            </Button>
            <InstagramReportExport
              posts={periodPosts}
              areas={data.areas}
              users={data.users}
              accountStats={account}
              filterDescription={period.label}
              menu
            />
          </>
        }
      />

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
            notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : notice.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-medium underline-offset-2 hover:underline">
            Fechar
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Seções do Instagram" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[#dce9eb] [scrollbar-width:none]">
        {TABS.map((item) => {
          const selected = tab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.key)}
              className={cn(
                "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                selected ? "font-semibold text-[#10232d]" : "text-[#4a6470] hover:text-[#10232d]"
              )}
            >
              <Icon className={cn("size-4", selected ? "text-[#347796]" : "text-[#7f97a1]")} aria-hidden />
              {item.label}
              {item.key === "conteudo" && pendingLinks > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-900" title="Posts do período sem área">
                  {pendingLinks}
                </span>
              )}
              {selected && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-[#347796]" aria-hidden />}
            </button>
          );
        })}
      </div>

      {tab === "visao" && (
        <InstagramOverviewTab
          period={period}
          insights={data.insights}
          posts={posts}
          followersHistory={data.followersHistory}
          monthlyGoal={monthlyGoal}
          onMonthlyGoalChange={changeMonthlyGoal}
          onOpenPost={setOpenPost}
        />
      )}
      {tab === "conteudo" && <InstagramContentTab period={period} posts={posts} users={data.users} onOpenPost={setOpenPost} />}
      {tab === "stories" && <InstagramStoriesTab period={period} stories={data.stories} />}
      {tab === "audiencia" && (
        <InstagramAudienceTab period={period} insights={data.insights} demographics={data.demographics} followersHistory={data.followersHistory} />
      )}
      {tab === "areas" && (
        <InstagramAreaDashboard
          posts={posts}
          areas={data.areas}
          users={data.users}
          accountStats={account}
          periodRange={toDateRange(period.from, period.to)}
          periodLabel={period.label}
        />
      )}
      {tab === "concorrentes" && (
        <InstagramCompetitorsTab
          period={period}
          competitors={data.competitors}
          posts={posts}
          accountStats={account}
          followersHistory={data.followersHistory}
          ownNetFollowers={kpis.netFollowers}
        />
      )}

      <PostDetailDialog
        post={openPost}
        open={openPost !== null}
        onOpenChange={(next) => !next && setOpenPost(null)}
        areas={data.areas}
        users={data.users}
        averageRate={averageRate}
        saving={savingId !== null}
        onSave={handleSave}
      />
    </div>
  );
}
