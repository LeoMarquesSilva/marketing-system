"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  MessageSquareText,
  MousePointerClick,
  PenLine,
  Sparkles,
  Trophy,
  UserPlus,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FreshnessBadge, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { CHANNEL_COLORS, LineSeriesChart, Sparkline, TrendChart } from "@/components/social-metrics/metrics-charts";
import { MetricsPeriodBar, useMetricsPeriod } from "@/components/social-metrics/metrics-period-bar";
import { deltaPercent, formatCompact, formatDateTime, formatDelta, formatInt, formatPercent, formatSigned } from "@/lib/social-metrics/format";
import { dateInSaoPaulo, eachDate, formatFullDate, isDateInRange } from "@/lib/social-metrics/period";
import { dailySeries, postDate, postsInRange, sortPosts } from "@/lib/social-metrics/instagram";
import { computeMetricsSummary, type MetricsSummaryData } from "@/lib/social-metrics/summary";
import type { SourceFreshness } from "@/lib/social-metrics/freshness";

/* ---------------------------------------------------------------- peças */

function ChannelMark({ channel }: { channel: "instagram" | "linkedin" | "site" }) {
  const Icon = channel === "instagram" ? Instagram : channel === "linkedin" ? Linkedin : Globe;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md text-white",
        channel === "instagram" && "bg-gradient-to-tr from-[#c47f2a] via-[#c2557a] to-[#7466b4]",
        channel === "linkedin" && "bg-[#0A66C2]",
        channel === "site" && "bg-[#1f9fa2]"
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

function MiniKpi({
  label,
  icon: Icon,
  value,
  current,
  previous,
  inverse,
  spark,
  color,
  empty,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  current: number | null;
  previous: number | null;
  inverse?: boolean;
  spark?: (number | null)[];
  color: string;
  empty?: boolean;
}) {
  const delta = deltaPercent(current, previous);
  const good = delta === null || Math.abs(delta) < 0.5 ? null : inverse ? delta < 0 : delta > 0;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#edf3f5] py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs text-[#4a6470]">
          <Icon className="size-3.5 text-[#3e84a8]" aria-hidden />
          {label}
        </p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-xl font-semibold text-[#10232d]">{empty ? "—" : value}</span>
          {!empty && (
            <span className={cn("text-xs font-medium", good === null ? "text-[#4a6470]" : good ? "text-emerald-700" : "text-rose-700")}>
              {formatDelta(delta)}
            </span>
          )}
        </p>
      </div>
      {spark && spark.some((v) => v !== null) && (
        <div className="h-9 w-24 shrink-0" aria-hidden>
          <Sparkline values={spark} color={color} />
        </div>
      )}
    </div>
  );
}

function ChannelColumn({
  channel,
  title,
  href,
  freshness,
  children,
  emptyMessage,
}: {
  channel: "instagram" | "linkedin" | "site";
  title: string;
  href: string;
  freshness: SourceFreshness;
  children: React.ReactNode;
  emptyMessage?: string | null;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-[#dce9eb] bg-white p-5 shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ChannelMark channel={channel} />
          <h3 className="text-base font-semibold text-[#10232d]">{title}</h3>
        </div>
        <FreshnessBadge freshness={freshness} compact className="min-h-7 px-2.5" />
      </header>
      {emptyMessage && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{emptyMessage}</p>}
      <div className="flex flex-1 flex-col">{children}</div>
      <Link href={href} className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-[#347796] hover:underline">
        Ver {title} em detalhe <ArrowRight className="size-3" aria-hidden />
      </Link>
    </section>
  );
}

/* --------------------------------------------------------------- leitura */

function ReadingCard({
  period,
  note,
  canWrite,
}: {
  period: ReturnType<typeof useMetricsPeriod>;
  note: MetricsSummaryData["notes"][number] | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(note?.note ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setDraft(note?.note ?? ""), [note?.note]);

  const body = () => ({
    periodo: period.state.preset,
    comparar: period.state.compare,
    de: period.period.from,
    ate: period.period.to,
  });

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/metricas/leitura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar a leitura");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a leitura");
    } finally {
      setGenerating(false);
    }
  };

  const saveNote = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/metricas/leitura", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body(), note: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const bullets = (note?.aiSummary ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <MetricsSection
      title="Leitura do período"
      icon={Sparkles}
      description={`O que os números de ${formatFullDate(period.period.from)} a ${formatFullDate(period.period.to)} dizem, para quem não é do marketing.`}
      action={
        canWrite ? (
          <Button variant={note?.aiSummary ? "outline" : "default"} size="sm" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {generating ? "Escrevendo…" : note?.aiSummary ? "Gerar de novo" : "Gerar leitura com IA"}
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {bullets.length ? (
            <>
              <ul className="space-y-2.5">
                {bullets.map((item, index) => (
                  <li key={index} className="flex gap-3 text-sm leading-relaxed text-[#1d3440]">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#347796]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Escrita pela IA em {formatDateTime(note?.aiGeneratedAt)} a partir dos números desta tela. Confira antes de repassar.</p>
            </>
          ) : (
            <MetricsEmpty
              icon={Sparkles}
              title="Sem leitura para este período"
              description={canWrite ? "Clique em “Gerar leitura com IA”: ela resume os números dos três canais em até 5 tópicos." : "O marketing ainda não gerou a leitura deste período."}
            />
          )}
        </div>
        <div className="rounded-lg border border-[#e3eef0] bg-[#fbfdfd] p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[#10232d]">
              <MessageSquareText className="size-4 text-[#347796]" aria-hidden />
              Comentário do marketing
            </p>
            {canWrite && !editing && (
              <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
                <PenLine aria-hidden />
                {note?.note ? "Editar" : "Escrever"}
              </Button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} placeholder="Contexto que os números não mostram: campanha, evento, mudança de pauta…" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveNote} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Salvar
                </Button>
              </div>
            </div>
          ) : note?.note ? (
            <>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#1d3440]">{note.note}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {note.noteUpdatedBy ?? "Marketing"} · {formatDateTime(note.noteUpdatedAt)}
              </p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">Sem comentário para este período.</p>
          )}
        </div>
      </div>
      {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
    </MetricsSection>
  );
}

/* ------------------------------------------------------------------ tela */

export function MetricsSummaryClient({ data, canWriteReading }: { data: MetricsSummaryData; canWriteReading: boolean }) {
  const periodState = useMetricsPeriod();
  const { state, period, setState } = periodState;
  const { from, to } = period;
  const summary = React.useMemo(() => computeMetricsSummary(data, period), [data, period]);
  const note = data.notes.find((item) => item.periodStart === period.from && item.periodEnd === period.to) ?? null;
  const dates = React.useMemo(() => eachDate(period.from, period.to), [period.from, period.to]);

  const igSpark = (field: "views" | "follows") =>
    data.instagram ? dailySeries(data.instagram.insights, field, period.from, period.to).map((p) => p.value) : undefined;
  const liByDate = React.useMemo(() => new Map((data.linkedin?.days ?? []).map((day) => [day.date, day])), [data.linkedin]);
  const liFollowersByDate = React.useMemo(() => new Map((data.linkedin?.followers ?? []).map((day) => [day.date, day.newFollowers])), [data.linkedin]);
  const siteByDate = React.useMemo(() => new Map((data.site?.days ?? []).map((day) => [day.date, day])), [data.site]);
  const socialByDate = React.useMemo(() => new Map((data.site?.social ?? []).map((row) => [row.date, row.value])), [data.site]);

  // Novos seguidores por canal (semanal quando o período passa de 45 dias).
  const followersChart = React.useMemo(() => {
    const igFollows = data.instagram ? new Map(dailySeries(data.instagram.insights, "follows", period.from, period.to).map((p) => [p.date, p.value])) : null;
    const rows = dates.map((date) => ({
      date,
      instagram: igFollows ? igFollows.get(date) ?? null : null,
      linkedin: data.linkedin ? liFollowersByDate.get(date) ?? null : null,
    }));
    if (dates.length <= 45) return rows;
    const weeks: typeof rows = [];
    for (let index = 0; index < rows.length; index += 7) {
      const chunk = rows.slice(index, index + 7);
      const sum = (key: "instagram" | "linkedin") =>
        chunk.some((row) => row[key] !== null) ? chunk.reduce((total, row) => total + (row[key] ?? 0), 0) : null;
      weeks.push({ date: chunk[0].date, instagram: sum("instagram"), linkedin: sum("linkedin") });
    }
    return weeks;
  }, [data.instagram, data.linkedin, dates, liFollowersByDate, period.from, period.to]);

  const socialTrend = React.useMemo(() => {
    const before = eachDate(period.compareFrom, period.compareTo);
    return dates.map((date, index) => ({
      date,
      value: siteByDate.has(date) ? socialByDate.get(date) ?? 0 : null,
      previous: before[index] && siteByDate.has(before[index]) ? socialByDate.get(before[index]) ?? 0 : null,
      previousDate: before[index],
    }));
  }, [dates, period.compareFrom, period.compareTo, siteByDate, socialByDate]);

  const topContents = React.useMemo(() => {
    const items: { key: string; channel: "instagram" | "linkedin"; cover: string | null; title: string; date: string; metric: string; metricLabel: string; href: string | null }[] = [];
    if (data.instagram) {
      for (const post of sortPosts(postsInRange(data.instagram.posts, from, to), "reach").slice(0, 3)) {
        items.push({
          key: post.id,
          channel: "instagram",
          cover: post.thumbnail_url ?? post.media_url,
          title: post.caption ?? "Sem legenda",
          date: postDate(post),
          metric: formatCompact(post.reach),
          metricLabel: "alcance",
          href: post.permalink,
        });
      }
    }
    if (data.linkedin) {
      const posts = data.linkedin.posts
        .filter((post) => isDateInRange(dateInSaoPaulo(post.publishedAt), from, to))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 3);
      for (const post of posts) {
        items.push({
          key: post.id,
          channel: "linkedin",
          cover: post.coverUrl,
          title: post.caption ?? "Sem texto",
          date: dateInSaoPaulo(post.publishedAt),
          metric: formatCompact(post.impressions),
          metricLabel: "impressões",
          href: post.permalink,
        });
      }
    }
    return items;
  }, [data.instagram, data.linkedin, from, to]);

  const linkedinEmpty =
    data.linkedin && summary.linkedin && summary.linkedin.current.daysWithData === 0
      ? `Sem dados do LinkedIn neste período: a última importação vai até ${data.linkedin.freshness.dataUntil ? formatFullDate(data.linkedin.freshness.dataUntil) : "—"}. Importe as planilhas na tela do LinkedIn.`
      : null;
  const siteEmpty =
    data.site && summary.site && summary.site.current.daysWithData === 0 ? "Sem dados do site neste período." : null;

  const freshnessList = [data.instagram?.freshness, data.linkedin?.freshness, data.site?.freshness].filter(
    (item): item is SourceFreshness => Boolean(item)
  );

  return (
    <div className="flex min-h-0 w-full flex-col gap-5">
      <MetricsPeriodBar state={state} period={period} onChange={setState} />

      {canWriteReading && <ReadingCard period={periodState} note={note} canWrite={canWriteReading} />}
      {!canWriteReading && note?.aiSummary && data.channels.instagram && data.channels.linkedin && data.channels.site && (
        <ReadingCard period={periodState} note={note} canWrite={false} />
      )}

      <div className={cn("grid gap-5", freshnessList.length >= 3 ? "xl:grid-cols-3" : freshnessList.length === 2 ? "lg:grid-cols-2" : "")}>
        {data.instagram && summary.instagram && (
          <ChannelColumn channel="instagram" title="Instagram" href={`/instagram-insights`} freshness={data.instagram.freshness}>
            <MiniKpi
              label="Visualizações"
              icon={Sparkles}
              value={formatCompact(summary.instagram.current.views)}
              current={summary.instagram.current.views}
              previous={summary.instagram.previous.views}
              spark={igSpark("views")}
              color={CHANNEL_COLORS.instagram}
            />
            <MiniKpi
              label="Saldo de seguidores"
              icon={UserPlus}
              value={formatSigned(summary.instagram.current.netFollowers)}
              current={summary.instagram.current.netFollowers}
              previous={summary.instagram.previous.netFollowers}
              spark={igSpark("follows")}
              color={CHANNEL_COLORS.instagram}
            />
            <MiniKpi
              label="Taxa de engajamento dos posts"
              icon={Trophy}
              value={formatPercent(summary.instagram.current.engagementRate, 2)}
              current={summary.instagram.current.engagementRate}
              previous={summary.instagram.previous.engagementRate}
              color={CHANNEL_COLORS.instagram}
            />
          </ChannelColumn>
        )}

        {data.linkedin && summary.linkedin && (
          <ChannelColumn channel="linkedin" title="LinkedIn" href="/linkedin-insights" freshness={data.linkedin.freshness} emptyMessage={linkedinEmpty}>
            <MiniKpi
              label="Impressões"
              icon={Sparkles}
              value={formatCompact(summary.linkedin.current.impressions)}
              current={summary.linkedin.current.impressions}
              previous={summary.linkedin.previous.impressions}
              spark={dates.map((date) => liByDate.get(date)?.impressions ?? null)}
              color={CHANNEL_COLORS.linkedin}
              empty={summary.linkedin.current.impressions === null}
            />
            <MiniKpi
              label="Cliques (CTR)"
              icon={MousePointerClick}
              value={`${formatInt(summary.linkedin.current.clicks)} · ${formatPercent(summary.linkedin.current.ctr, 1)}`}
              current={summary.linkedin.current.clicks}
              previous={summary.linkedin.previous.clicks}
              color={CHANNEL_COLORS.linkedin}
              empty={summary.linkedin.current.clicks === null}
            />
            <MiniKpi
              label="Novos seguidores"
              icon={UserPlus}
              value={formatInt(summary.linkedin.current.newFollowers)}
              current={summary.linkedin.current.newFollowers}
              previous={summary.linkedin.previous.newFollowers}
              spark={dates.map((date) => liFollowersByDate.get(date) ?? null)}
              color={CHANNEL_COLORS.linkedin}
              empty={summary.linkedin.current.newFollowers === null}
            />
          </ChannelColumn>
        )}

        {data.site && summary.site && (
          <ChannelColumn channel="site" title="Site" href="/ga4-insights" freshness={data.site.freshness} emptyMessage={siteEmpty}>
            <MiniKpi
              label="Sessões"
              icon={Globe}
              value={formatCompact(summary.site.current.sessions)}
              current={summary.site.current.sessions}
              previous={summary.site.previous.sessions}
              spark={dates.map((date) => siteByDate.get(date)?.sessions ?? null)}
              color={CHANNEL_COLORS.site}
              empty={summary.site.current.sessions === null}
            />
            <MiniKpi
              label="Leads (formulários) + WhatsApp"
              icon={MessageSquareText}
              value={`${formatInt(summary.site.current.leads)} + ${formatInt(summary.site.current.whatsapp)}`}
              current={(summary.site.current.leads ?? 0) + (summary.site.current.whatsapp ?? 0)}
              previous={summary.site.previous.sessions === null ? null : (summary.site.previous.leads ?? 0) + (summary.site.previous.whatsapp ?? 0)}
              color={CHANNEL_COLORS.site}
              empty={summary.site.current.sessions === null}
            />
            <MiniKpi
              label="Sessões vindas das redes"
              icon={Waypoints}
              value={`${formatInt(summary.site.current.socialSessions)} · ${formatPercent(summary.site.current.socialShare, 1)}`}
              current={summary.site.current.socialSessions}
              previous={summary.site.previous.socialSessions}
              spark={dates.map((date) => (siteByDate.has(date) ? socialByDate.get(date) ?? 0 : null))}
              color={CHANNEL_COLORS.site}
              empty={summary.site.current.sessions === null}
            />
          </ChannelColumn>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {(data.instagram || data.linkedin) && (
          <MetricsSection
            title="Novos seguidores por canal"
            icon={UserPlus}
            description={dates.length > 45 ? "Soma por semana." : "Por dia. LinkedIn só até a última importação."}
          >
            {followersChart.some((row) => row.instagram !== null || row.linkedin !== null) ? (
              <LineSeriesChart
                data={followersChart}
                series={[
                  ...(data.instagram ? [{ key: "instagram", label: "Instagram (começaram a seguir)", color: CHANNEL_COLORS.instagram }] : []),
                  ...(data.linkedin ? [{ key: "linkedin", label: "LinkedIn (novos seguidores)", color: CHANNEL_COLORS.linkedin }] : []),
                ]}
                domainFromData={false}
              />
            ) : (
              <MetricsEmpty icon={UserPlus} title="Sem dados de seguidores no período" />
            )}
          </MetricsSection>
        )}

        {data.site && (
          <MetricsSection
            title="Das redes para o site"
            icon={Waypoints}
            description="Sessões no site que chegaram pelas redes sociais (Google Analytics), dia a dia."
          >
            {socialTrend.some((point) => point.value !== null) ? (
              <TrendChart data={socialTrend} label="Sessões vindas das redes" previousLabel={period.compareLabel} color={CHANNEL_COLORS.site} height={220} />
            ) : (
              <MetricsEmpty icon={Waypoints} title="Sem dados do site no período" />
            )}
          </MetricsSection>
        )}
      </div>

      <MetricsSection title="Melhores conteúdos do período" icon={Trophy} description="Top 3 do Instagram (alcance) e do LinkedIn (impressões).">
        {topContents.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {topContents.map((item) => (
              <a
                key={`${item.channel}-${item.key}`}
                href={item.href ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#dce9eb] bg-white transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)]"
              >
                <div className="relative aspect-[4/5] bg-[#eef3f5]">
                  {item.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#9fb4bd]">
                      {item.channel === "linkedin" ? <Linkedin className="size-8" aria-hidden /> : <Instagram className="size-8" aria-hidden />}
                    </div>
                  )}
                  <span className="absolute left-2 top-2">
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md text-white shadow-sm",
                        item.channel === "instagram" ? "bg-gradient-to-tr from-[#c47f2a] via-[#c2557a] to-[#7466b4]" : "bg-[#0A66C2]"
                      )}
                    >
                      {item.channel === "instagram" ? <Instagram className="size-3.5" aria-hidden /> : <Linkedin className="size-3.5" aria-hidden />}
                    </span>
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{item.date ? formatFullDate(item.date) : ""}</span>
                    <span className="text-right">
                      <span className="block font-mono text-base font-semibold leading-none text-[#10232d]">{item.metric}</span>
                      <span className="text-xs text-muted-foreground">{item.metricLabel}</span>
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-[#36505c]">{item.title}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <MetricsEmpty icon={Trophy} title="Nenhum conteúdo publicado no período" />
        )}
      </MetricsSection>

      <p className="text-xs text-muted-foreground">
        Dados do Instagram até {data.instagram?.freshness.dataUntil ? formatFullDate(data.instagram.freshness.dataUntil) : "—"}
        {data.linkedin ? ` · LinkedIn até ${data.linkedin.freshness.dataUntil ? formatFullDate(data.linkedin.freshness.dataUntil) : "—"}` : ""}
        {data.site ? ` · Site até ${data.site.freshness.dataUntil ? formatFullDate(data.site.freshness.dataUntil) : "—"}` : ""}. Período anterior para comparação: {period.compareLabel}.
      </p>
    </div>
  );
}
