"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarSearch,
  CircleAlert,
  FileClock,
  FileUp,
  Grid3X3,
  LayoutDashboard,
  Linkedin,
  Loader2,
  Shapes,
  Swords,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FreshnessBadge } from "@/components/social-metrics/metrics-ui";
import { MetricsPeriodBar, useMetricsPeriod } from "@/components/social-metrics/metrics-period-bar";
import { LinkedinOverviewTab } from "@/components/linkedin/linkedin-overview-tab";
import { LinkedinAudienceTab } from "@/components/linkedin/linkedin-audience-tab";
import { LinkedinPostsTab, type LinkedinLinkFilter } from "@/components/linkedin/linkedin-posts-tab";
import { LinkedinPeopleTab } from "@/components/linkedin/linkedin-people-tab";
import { LinkedinCompetitorsTab } from "@/components/linkedin/linkedin-competitors-tab";
import { LinkedinImportsTab } from "@/components/linkedin/linkedin-imports-tab";
import { LINKEDIN_STALE_DAYS, LinkedinImportDialog, daysSince, type LinkedinImportSummary } from "@/components/linkedin/linkedin-import-dialog";
import {
  LinkedinPostDetailDialog,
  linkedinPostsInRange,
  type LinkedinMetricsUser,
} from "@/components/linkedin/linkedin-post-pieces";
import { computeLinkedinPeriodTotals, linkedinDataRange, linkedinPostEngagementPercent } from "@/lib/linkedin-analytics";
import { formatInt, formatSigned } from "@/lib/social-metrics/format";
import { addDays, formatFullDate, isDateInRange, todayInSaoPaulo } from "@/lib/social-metrics/period";
import type { SourceFreshness } from "@/lib/social-metrics/freshness";
import type { LinkedinReportFreshness } from "@/lib/social-metrics/server";
import type { LinkedinDashboardData } from "@/lib/linkedin-types";

type TabKey = "visao" | "publicacoes" | "audiencia" | "areas" | "concorrentes" | "importacoes";

const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "visao", label: "Visão geral", icon: LayoutDashboard },
  { key: "publicacoes", label: "Publicações", icon: Grid3X3 },
  { key: "audiencia", label: "Seguidores e visitantes", icon: UsersRound },
  { key: "areas", label: "Áreas e autores", icon: Shapes },
  { key: "concorrentes", label: "Concorrentes", icon: Swords },
  { key: "importacoes", label: "Importações", icon: FileClock },
];

type Notice = { tone: "ok" | "warning" | "error"; text: string };

function importNotice(summary: LinkedinImportSummary): Notice | null {
  const { imported, duplicates, failed } = summary;
  if (imported + duplicates + failed === 0) return null;
  const parts: string[] = [];
  if (imported) parts.push(`${imported} planilha(s) importada(s)`);
  if (duplicates) parts.push(`${duplicates} já estava(m) importada(s)`);
  if (failed) parts.push(`${failed} com erro (veja o motivo em Importar planilhas)`);
  return { tone: failed ? (imported ? "warning" : "error") : "ok", text: `LinkedIn: ${parts.join(", ")}.` };
}

export function LinkedinMetricsClient({
  data,
  freshness,
  reports,
  users,
}: {
  data: LinkedinDashboardData;
  freshness: SourceFreshness;
  reports: LinkedinReportFreshness[];
  users: LinkedinMetricsUser[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, period, setState } = useMetricsPeriod();
  const tab = (TABS.find((item) => item.key === searchParams.get("aba"))?.key ?? "visao") as TabKey;

  const [today] = React.useState(() => todayInSaoPaulo());
  const [importOpen, setImportOpen] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [openPostId, setOpenPostId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [refreshing, startRefresh] = React.useTransition();
  const [linkFilter, setLinkFilter] = React.useState<LinkedinLinkFilter>("todos");

  const setTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "visao") params.delete("aba");
    else params.set("aba", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const current = React.useMemo(() => computeLinkedinPeriodTotals(data, period.from, period.to), [data, period.from, period.to]);
  const previous = React.useMemo(
    () => computeLinkedinPeriodTotals(data, period.compareFrom, period.compareTo),
    [data, period.compareFrom, period.compareTo]
  );
  const periodPosts = React.useMemo(() => linkedinPostsInRange(data.posts, period.from, period.to), [data.posts, period.from, period.to]);
  const previousPostsCount = React.useMemo(
    () => linkedinPostsInRange(data.posts, period.compareFrom, period.compareTo).length,
    [data.posts, period.compareFrom, period.compareTo]
  );
  const range = React.useMemo(() => linkedinDataRange(data), [data]);
  const linkedCount = periodPosts.filter((post) => post.instagram_post_id).length;
  const pendingLinks = periodPosts.length - linkedCount;
  const averageRate = periodPosts.length
    ? periodPosts.reduce((sum, post) => sum + linkedinPostEngagementPercent(post), 0) / periodPosts.length
    : null;
  const openPost = openPostId ? data.posts.find((post) => post.id === openPostId) ?? null : null;

  // Aviso de dado parado: último dia importado com mais de 35 dias ou período sem nenhum dia.
  const dataUntil = freshness.dataUntil ?? range.last;
  const age = daysSince(dataUntil, today);
  const stale = dataUntil === null || (age !== null && age > LINKEDIN_STALE_DAYS);
  const daysWithData = Math.max(current.contentDays, current.followerDays, current.visitorDays);
  const periodEmpty = daysWithData === 0;
  const canJumpToData = Boolean(dataUntil) && !isDateInRange(dataUntil, period.from, period.to);

  const handleLink = async (linkedinPostId: string, instagramPostId: string | null) => {
    setSavingId(linkedinPostId);
    try {
      const response = await fetch(`/api/linkedin-insights/posts/${linkedinPostId}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramPostId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Erro ao atualizar o vínculo.");
      startRefresh(() => router.refresh());
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Erro ao atualizar o vínculo." });
    } finally {
      setSavingId(null);
    }
  };

  const jumpToLatest = () => {
    if (!dataUntil) return;
    setState({ preset: "personalizado", compare: state.compare, from: addDays(dataUntil, -27), to: dataUntil });
  };

  return (
    <div className="flex min-h-0 w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-[#0A66C2] text-white" aria-hidden>
            <Linkedin className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-[#10232d]">Bismarchi | Pires</p>
            <p className="text-sm text-muted-foreground">Página da empresa no LinkedIn</p>
          </div>
          <dl className="hidden items-stretch gap-0 divide-x divide-[#dce9eb] rounded-lg border border-[#dce9eb] bg-white md:flex">
            <div className="px-4 py-2">
              <dt className="text-xs text-muted-foreground">Novos seguidores no período</dt>
              <dd className={cn("font-mono text-base font-semibold", current.newFollowers ? "text-emerald-700" : "text-[#10232d]")}>
                {formatSigned(current.newFollowers)}
              </dd>
            </div>
            <div className="px-4 py-2">
              <dt className="text-xs text-muted-foreground">Publicações no período</dt>
              <dd className="font-mono text-base font-semibold text-[#10232d]">{formatInt(periodPosts.length)}</dd>
            </div>
            <div className="px-4 py-2">
              <dt className="text-xs text-muted-foreground">Com post do Instagram</dt>
              <dd className="font-mono text-base font-semibold text-[#10232d]">
                {formatInt(linkedCount)}
                <span className="text-sm font-normal text-muted-foreground">/{formatInt(periodPosts.length)}</span>
              </dd>
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
            <FreshnessBadge freshness={freshness} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              {importProgress ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
              {importProgress ? `Importando ${importProgress.done}/${importProgress.total}…` : "Importar planilhas"}
            </Button>
          </>
        }
      />

      {data.unavailableReason && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Não foi possível ler os dados do LinkedIn</p>
            <p className="mt-0.5 text-xs">{data.unavailableReason}</p>
          </div>
        </div>
      )}

      {!data.unavailableReason && (stale || periodEmpty) && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <TriangleAlert className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                {dataUntil === null
                  ? "Ainda não há dados do LinkedIn."
                  : stale
                    ? `O LinkedIn está sem dados desde ${formatFullDate(dataUntil)} (${age} dias).`
                    : `Nenhum dado do LinkedIn entre ${formatFullDate(period.from)} e ${formatFullDate(period.to)}.`}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
                {stale
                  ? "Exporte os 4 relatórios da página (Conteúdo, Seguidores, Visitantes, Concorrentes) e importe aqui."
                  : `Os dados importados vão de ${range.first ? formatFullDate(range.first) : "—"} a ${dataUntil ? formatFullDate(dataUntil) : "—"}. Escolha outro período ou importe as planilhas que faltam.`}
                {stale && dataUntil && (periodEmpty ? " Neste período não há nenhum dia com dado." : ` Neste período, só ${daysWithData} de ${period.days} dias têm dado.`)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 pl-12 md:pl-0">
            {canJumpToData && dataUntil && (
              <Button variant="outline" size="sm" onClick={jumpToLatest}>
                <CalendarSearch className="size-4" aria-hidden />
                Ver os 28 dias até {formatFullDate(dataUntil).slice(0, 5)}
              </Button>
            )}
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <FileUp className="size-4" aria-hidden />
              Importar planilhas
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : notice.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-medium underline-offset-2 hover:underline">
            Fechar
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Seções do LinkedIn" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[#dce9eb]">
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
              {item.key === "publicacoes" && pendingLinks > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-900" title="Publicações do período sem post do Instagram vinculado">
                  {pendingLinks}
                </span>
              )}
              {item.key === "importacoes" && stale && (
                <span className="size-2 rounded-full bg-amber-500" title="Relatórios desatualizados" aria-label="Relatórios desatualizados" />
              )}
              {selected && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-[#347796]" aria-hidden />}
            </button>
          );
        })}
      </div>

      {tab === "visao" && (
        <LinkedinOverviewTab
          period={period}
          data={data}
          current={current}
          previous={previous}
          periodPosts={periodPosts}
          previousPostsCount={previousPostsCount}
          dataUntil={dataUntil}
          onOpenPost={(post) => setOpenPostId(post.id)}
        />
      )}
      {tab === "publicacoes" && (
        <LinkedinPostsTab
          period={period}
          posts={data.posts}
          users={users}
          linkFilter={linkFilter}
          onLinkFilterChange={setLinkFilter}
          onOpenPost={(post) => setOpenPostId(post.id)}
        />
      )}
      {tab === "audiencia" && <LinkedinAudienceTab period={period} data={data} current={current} previous={previous} />}
      {tab === "areas" && (
        <LinkedinPeopleTab
          posts={periodPosts}
          users={users}
          onShowPending={() => {
            setLinkFilter("sem-vinculo");
            setTab("publicacoes");
          }}
        />
      )}
      {tab === "concorrentes" && <LinkedinCompetitorsTab data={data} onImport={() => setImportOpen(true)} />}
      {tab === "importacoes" && (
        <LinkedinImportsTab imports={data.imports} reports={reports} users={users} onImport={() => setImportOpen(true)} />
      )}

      <LinkedinPostDetailDialog
        post={openPost}
        open={openPost !== null}
        onOpenChange={(next) => !next && setOpenPostId(null)}
        candidates={data.instagramCandidates}
        users={users}
        averageRate={averageRate}
        saving={savingId !== null || refreshing}
        onLink={handleLink}
      />

      <LinkedinImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        reports={reports}
        disabledReason={data.unavailableReason}
        onBusyChange={setImportProgress}
        onFinished={(summary) => setNotice(importNotice(summary))}
      />
    </div>
  );
}
