"use client";

import * as React from "react";
import { Globe2, MapPin, Radar, UserRound, Users } from "lucide-react";
import { MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { BarList, CHART_COLORS, LineSeriesChart, ShareBar } from "@/components/social-metrics/metrics-charts";
import { formatInt, formatPercent } from "@/lib/social-metrics/format";
import { addDays, eachDate, formatFullDate, type ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import { followersByDay, sumInsight, type InsightDay } from "@/lib/social-metrics/instagram";
import type { InstagramDemographicRow } from "@/lib/instagram-demographics";
import type { FollowersPoint } from "@/lib/social-metrics/server";

const GENDER_LABELS: Record<string, string> = { F: "Mulheres", M: "Homens", U: "Não informado" };
const COUNTRY_NAMES = new Intl.DisplayNames(["pt-BR"], { type: "region" });

function countryName(code: string): string {
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "São Paulo, São Paulo (state)" → "São Paulo, SP"-like curto. */
function cityName(label: string): string {
  const [city, state] = label.split(",").map((part) => part.trim());
  if (!state) return city;
  return `${city} · ${state.replace(/\s*\(state\)\s*/i, "").replace(/ State$/i, "")}`;
}

export function InstagramAudienceTab({
  period,
  insights,
  demographics,
  followersHistory,
}: {
  period: ResolvedMetricsPeriod;
  insights: InsightDay[];
  demographics: InstagramDemographicRow[];
  followersHistory: FollowersPoint[];
}) {
  const followers = demographics.filter((row) => row.kind === "followers");
  const pick = (breakdown: string) =>
    followers.filter((row) => row.breakdown === breakdown).sort((a, b) => b.value - a.value);
  const gender = pick("gender");
  const age = pick("age").sort((a, b) => a.label.localeCompare(b.label));
  const cities = pick("city").slice(0, 10);
  const countries = pick("country").slice(0, 6);
  const genderTotal = gender.reduce((sum, row) => sum + row.value, 0);

  const reachFollowers = sumInsight(insights, "reach_followers", period.from, period.to);
  const reachOthers = sumInsight(insights, "reach_non_followers", period.from, period.to);
  const reachTotal = (reachFollowers.value ?? 0) + (reachOthers.value ?? 0);

  const longSeries = React.useMemo(() => {
    const byDay = followersByDay(followersHistory);
    const from = addDays(period.to, -364);
    return eachDate(from, period.to)
      .map((date) => ({ date, seguidores: byDay.get(date) ?? null }))
      .filter((point) => point.seguidores !== null);
  }, [followersHistory, period.to]);

  const snapshotDate = demographics[0]?.snapshot_date;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <MetricsSection
          title="Quem o conteúdo alcança"
          icon={Radar}
          description="Soma do alcance diário no período, separado entre quem já segue e quem ainda não segue."
        >
          {reachTotal > 0 ? (
            <ShareBar
              segments={[
                { key: "seguidores", label: "Já seguem", value: reachFollowers.value ?? 0, color: CHART_COLORS.blue },
                { key: "novos", label: "Ainda não seguem", value: reachOthers.value ?? 0, color: CHART_COLORS.ochre },
              ]}
            />
          ) : (
            <MetricsEmpty icon={Radar} title="Sem esse detalhe no período" description="A Meta só separa seguidores e não seguidores desde 23/11/2025." />
          )}
          {reachTotal > 0 && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {formatPercent(((reachOthers.value ?? 0) / reachTotal) * 100, 0)} do alcance veio de quem ainda não segue o escritório: é a parte que traz público novo.
            </p>
          )}
        </MetricsSection>

        <MetricsSection title="Seguidores no último ano" icon={Users} description={`Total diário até ${formatFullDate(period.to)}.`}>
          {longSeries.length > 1 ? (
            <LineSeriesChart data={longSeries} series={[{ key: "seguidores", label: "Seguidores", color: CHART_COLORS.blue }]} height={200} />
          ) : (
            <MetricsEmpty icon={Users} title="Histórico curto" />
          )}
        </MetricsSection>
      </div>

      <MetricsSection
        title="Perfil dos seguidores"
        icon={UserRound}
        description={snapshotDate ? `Retrato da Meta em ${formatFullDate(snapshotDate)} (atualiza todo dia; não depende do período).` : "Retrato da Meta (não depende do período)."}
      >
        {followers.length === 0 ? (
          <MetricsEmpty icon={UserRound} title="Sem dados de perfil" description="A Meta só mostra o perfil de contas com 100 seguidores ou mais." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[#4a6470]">Gênero</p>
              <ShareBar
                segments={gender.map((row, index) => ({
                  key: row.label,
                  label: GENDER_LABELS[row.label] ?? row.label,
                  value: row.value,
                  color: [CHART_COLORS.blue, CHART_COLORS.ochre, CHART_COLORS.previous][index] ?? CHART_COLORS.previous,
                }))}
              />
              <p className="pt-2 text-xs font-semibold text-[#4a6470]">Idade</p>
              <BarList
                items={age.map((row) => ({
                  key: row.label,
                  label: `${row.label} anos`,
                  value: row.value,
                  hint: genderTotal ? formatPercent((row.value / genderTotal) * 100, 0) : undefined,
                }))}
                color={CHART_COLORS.purple}
              />
            </div>
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[#4a6470]">
                <MapPin className="size-3.5" aria-hidden />
                Cidades (top 10)
              </p>
              <BarList items={cities.map((row) => ({ key: row.label, label: cityName(row.label), value: row.value }))} color={CHART_COLORS.teal} />
            </div>
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[#4a6470]">
                <Globe2 className="size-3.5" aria-hidden />
                Países
              </p>
              <BarList items={countries.map((row) => ({ key: row.label, label: countryName(row.label), value: row.value }))} color={CHART_COLORS.blue} format={formatInt} />
            </div>
          </div>
        )}
      </MetricsSection>
    </div>
  );
}
