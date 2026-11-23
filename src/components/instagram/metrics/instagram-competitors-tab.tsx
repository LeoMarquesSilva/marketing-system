"use client";

import * as React from "react";
import Link from "next/link";
import { Crown, Settings2, Swords, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { BarList, CHART_COLORS } from "@/components/social-metrics/metrics-charts";
import { formatCompact, formatInt, formatPercent, formatSigned } from "@/lib/social-metrics/format";
import { addDays, dateInSaoPaulo, daysInclusive, formatFullDate, isDateInRange, type ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import { engagementPerFollower, followersAt, followersByDay, postFormat, postsInRange, POST_FORMAT_LABELS, type PostFormat } from "@/lib/social-metrics/instagram";
import type { CompetitorsData, FollowersPoint } from "@/lib/social-metrics/server";
import type { InstagramAccountStats, InstagramPost } from "@/lib/instagram-posts";

const WINDOW_DAYS = 90;

interface Row {
  key: string;
  name: string;
  username: string;
  kind: "nos" | "concorrente" | "referencia";
  picture: string | null;
  followers: number | null;
  growth: number | null;
  growthNote: string | null;
  perWeek: number | null;
  engagement: number | null;
  topFormat: string | null;
  basis: string;
}

function topFormatOf(formats: PostFormat[]): string | null {
  if (formats.length === 0) return null;
  const counts = new Map<PostFormat, number>();
  for (const format of formats) counts.set(format, (counts.get(format) ?? 0) + 1);
  const [format, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return `${POST_FORMAT_LABELS[format]} (${formatPercent((count / formats.length) * 100, 0)})`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function InstagramCompetitorsTab({
  period,
  competitors,
  posts,
  accountStats,
  followersHistory,
  ownNetFollowers,
}: {
  period: ResolvedMetricsPeriod;
  competitors: CompetitorsData;
  posts: InstagramPost[];
  accountStats: InstagramAccountStats | null;
  followersHistory: FollowersPoint[];
  /** Saldo do período pela Meta (começaram − deixaram de seguir), igual ao cabeçalho. */
  ownNetFollowers: number | null;
}) {
  const windowFrom = addDays(period.to, -(WINDOW_DAYS - 1));

  const rows = React.useMemo<Row[]>(() => {
    const ourDaily = followersByDay(followersHistory);
    const ourStart = followersAt(ourDaily, period.from);
    const ourEnd = followersAt(ourDaily, period.to);
    const ourPosts = postsInRange(posts, windowFrom, period.to);
    const ourFollowers = ourEnd ?? accountStats?.followers_count ?? null;
    const own: Row = {
      key: "nos",
      name: accountStats?.name ?? "Bismarchi | Pires",
      username: accountStats?.username ?? "bismarchipires",
      kind: "nos",
      picture: accountStats?.profile_picture_url ?? null,
      followers: ourFollowers,
      growth: ownNetFollowers ?? (ourStart !== null && ourEnd !== null ? ourEnd - ourStart : null),
      growthNote: null,
      perWeek: (ourPosts.length / WINDOW_DAYS) * 7,
      engagement: engagementPerFollower(ourPosts, ourFollowers),
      topFormat: topFormatOf(ourPosts.map(postFormat)),
      basis: `${ourPosts.length} posts em ${WINDOW_DAYS} dias`,
    };

    const others = competitors.accounts.map<Row>((account) => {
      const snaps = competitors.snapshots.filter((snap) => snap.accountId === account.id && snap.followers !== null);
      const inPeriod = snaps.filter((snap) => isDateInRange(snap.date, period.from, period.to));
      const first = inPeriod[0];
      const last = inPeriod[inPeriod.length - 1];
      const growth = first && last && first !== last ? (last.followers as number) - (first.followers as number) : null;
      const firstSnap = snaps[0]?.date;

      const own = competitors.posts.filter((post) => post.accountId === account.id);
      const dates = own.map((post) => dateInSaoPaulo(post.publishedAt)).filter(Boolean).sort();
      const oldest = dates[0];
      const effectiveFrom = oldest && oldest > windowFrom ? oldest : windowFrom;
      const windowPosts = own.filter((post) => isDateInRange(dateInSaoPaulo(post.publishedAt), effectiveFrom, period.to));
      const days = Math.max(7, daysInclusive(effectiveFrom, period.to));
      const rates = windowPosts
        .filter((post) => post.likes !== null && post.followersAtSync)
        .map((post) => (((post.likes ?? 0) + (post.comments ?? 0)) / (post.followersAtSync as number)) * 100);
      return {
        key: account.id,
        name: account.displayName ?? account.username,
        username: account.username,
        kind: account.kind === "concorrente" ? "concorrente" : "referencia",
        picture: account.profilePictureUrl,
        followers: account.followersCount,
        growth,
        growthNote: growth === null ? (firstSnap ? `medindo desde ${formatFullDate(firstSnap)}` : "sem histórico ainda") : null,
        perWeek: windowPosts.length ? (windowPosts.length / days) * 7 : null,
        engagement: rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : null,
        topFormat: topFormatOf(
          windowPosts.map((post) => postFormat({ media_type: post.mediaType, media_product_type: post.mediaProductType }))
        ),
        basis: `${windowPosts.length} posts em ${days} dias`,
      };
    });

    return [own, ...others].sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  }, [competitors, posts, accountStats, followersHistory, ownNetFollowers, period.from, period.to, windowFrom]);

  if (competitors.accounts.length === 0) {
    return (
      <MetricsEmpty
        icon={Swords}
        title="Nenhum concorrente cadastrado"
        description="Cadastre os perfis em Gerador de conteúdo › Configurações › Referências; eles aparecem aqui."
      />
    );
  }

  const ranking = [...rows].filter((row) => row.engagement !== null).sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <MetricsSection
        title="Escritórios comparados"
        icon={Swords}
        description="Perfis cadastrados no Gerador de conteúdo. A Meta não mostra o alcance de outras contas, então a comparação usa curtidas + comentários ÷ seguidores (vale entre os perfis, não com a nossa taxa de alcance)."
        action={
          <Link href="/conteudo/configuracoes" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#347796] hover:underline">
            <Settings2 className="size-3.5" aria-hidden />
            Editar lista
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#edf3f5] text-left text-xs text-[#6b8591]">
                <th className="py-2 pr-3 font-medium">Perfil</th>
                <th className="px-3 py-2 text-right font-medium">Seguidores</th>
                <th className="px-3 py-2 text-right font-medium">No período</th>
                <th className="px-3 py-2 text-right font-medium">Posts por semana</th>
                <th className="px-3 py-2 text-right font-medium">Engajamento por seguidor</th>
                <th className="py-2 pl-3 font-medium">Formato mais usado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={cn("border-b border-[#f1f5f7] last:border-0", row.kind === "nos" && "bg-[#f5fafc]")}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 ring-1 ring-[#dce9eb]">
                        {row.picture && <AvatarImage src={row.picture} alt="" />}
                        <AvatarFallback className="bg-[#e8f1f5] text-xs font-semibold text-[#315f73]">{initials(row.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium text-[#10232d]">
                          {row.name}
                          {row.kind === "nos" && <Crown className="size-3.5 text-[#c47f2a]" aria-label="Nosso perfil" />}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          @{row.username}
                          <span
                            className={cn(
                              "rounded-full px-1.5 text-xs",
                              row.kind === "nos" ? "bg-[#347796] text-white" : row.kind === "concorrente" ? "bg-rose-50 text-rose-700" : "bg-[#eef6f8] text-[#285f7a]"
                            )}
                          >
                            {row.kind === "nos" ? "nós" : row.kind === "concorrente" ? "concorrente" : "referência"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-medium text-[#10232d]">{formatCompact(row.followers)}</td>
                  <td className="px-3 py-3 text-right">
                    {row.growth !== null ? (
                      <span className={cn("font-mono font-medium", row.growth >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatSigned(row.growth)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{row.growthNote}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[#10232d]" title={row.basis}>
                    {row.perWeek === null ? "—" : row.perWeek.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-[#10232d]" title={row.basis}>
                    {formatPercent(row.engagement, 2)}
                  </td>
                  <td className="py-3 pl-3 text-xs text-[#36505c]">{row.topFormat ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Posts e engajamento: últimos {WINDOW_DAYS} dias até {formatFullDate(period.to)} (ou desde o post mais antigo lido de cada perfil). Seguidores dos outros perfis: foto diária desde 23/11/2026.
        </p>
      </MetricsSection>

      <MetricsSection title="Engajamento por seguidor" icon={TrendingUp} description="Média por post de (curtidas + comentários) ÷ seguidores.">
        <BarList
          items={ranking.map((row) => ({
            key: row.key,
            label: (
              <span className={cn(row.kind === "nos" && "font-semibold text-[#10232d]")}>
                {row.name} <span className="text-muted-foreground">@{row.username}</span>
              </span>
            ),
            value: row.engagement ?? 0,
          }))}
          format={(value) => formatPercent(value, 2)}
          color={CHART_COLORS.purple}
        />
        <p className="mt-3 text-xs text-muted-foreground">Total de perfis: {formatInt(rows.length)}.</p>
      </MetricsSection>
    </div>
  );
}
