"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Filter,
  Loader2,
  MessageSquareHeart,
  Plus,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NpsCampaign, NpsResponseRow } from "@/lib/nps/types";
import type { NpsOutreachAreaBreakdown, NpsOutreachProgress } from "@/lib/nps/eligible";
import {
  classifyNpsScore,
  type NpsBucket,
  type NpsDimensionAverages,
  type NpsScoreSummary,
} from "@/lib/nps/scoring";
import { NPS_QUESTIONS } from "@/lib/nps/questions";
import { cn } from "@/lib/utils";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { FilterUserAvatar } from "@/components/meus-clientes/meus-clientes-ui";

const RECOMMEND_QUESTION =
  NPS_QUESTIONS.find((q) => q.id === "score_recommend")?.label ??
  "Em uma escala de 0 a 10, o quanto você recomendaria o Bismarchi | Pires Sociedade de Advogados a um colega ou outras empresas?";
const IMPROVEMENT_QUESTION =
  NPS_QUESTIONS.find((q) => q.id === "improvement")?.label ??
  "Há algo que você acredita que poderíamos fazer para melhorar sua experiência?";

type ResponseFilter = "all" | NpsBucket;

interface GroupResult {
  clientGroupId: string;
  groupName: string;
  summary: NpsScoreSummary;
  dimensions: NpsDimensionAverages;
  responseCount: number;
}

interface ResultsPayload {
  campaign: NpsCampaign;
  campaigns: NpsCampaign[];
  isAdmin: boolean;
  summary: NpsScoreSummary;
  dimensions: NpsDimensionAverages;
  groups: GroupResult[];
  responses: Array<NpsResponseRow & { groupName: string }>;
  outreach: NpsOutreachProgress;
}

interface ResponseRow extends NpsResponseRow {
  groupName: string;
}

function npsTone(score: number | null): "good" | "mid" | "bad" | "empty" {
  if (score == null) return "empty";
  if (score >= 50) return "good";
  if (score >= 0) return "mid";
  return "bad";
}

function bucketLabel(bucket: NpsBucket): string {
  if (bucket === "promoter") return "Promotor";
  if (bucket === "passive") return "Neutro";
  return "Detrator";
}

function bucketBadgeClass(bucket: NpsBucket): string {
  if (bucket === "promoter") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (bucket === "passive") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function scoreColor(score: number | null): string {
  if (score == null) return "#94a3b8";
  if (score >= 50) return "#059669";
  if (score >= 0) return "#d97706";
  return "#dc2626";
}

function avgTone(value: number | null): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 9) return "text-emerald-700";
  if (value >= 7) return "text-amber-700";
  return "text-red-700";
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

type OutreachMetric = keyof Pick<
  NpsOutreachAreaBreakdown,
  "eligiblePeople" | "eligibleGroups" | "sentGroups" | "respondedPeople"
>;

function OutreachMeter({
  label,
  value,
  total,
  hint,
  icon: Icon,
  expanded,
  onToggle,
}: {
  label: string;
  value: number;
  total?: number;
  hint: string;
  icon: typeof Users;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ratio = total != null && total > 0 ? Math.min(100, (value / total) * 100) : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-colors",
        "hover:border-[#347796]/40 hover:bg-[#347796]/[0.03]",
        expanded && "border-[#347796] ring-1 ring-[#347796]/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1 text-[#347796]">
          <Icon className="h-3.5 w-3.5" />
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </div>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
        {value}
        {total != null && (
          <span className="ml-1 text-sm font-medium text-muted-foreground">/ {total}</span>
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      {ratio != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#347796]" style={{ width: `${ratio}%` }} />
        </div>
      )}
    </button>
  );
}

function groupMetricValue(
  group: NpsOutreachAreaBreakdown["groups"][number],
  metric: OutreachMetric
): number {
  if (metric === "eligiblePeople") return group.eligiblePeople;
  if (metric === "eligibleGroups") return 1;
  if (metric === "sentGroups") return group.sent ? 1 : 0;
  return group.respondedPeople;
}

function sendersForArea(groups: NpsOutreachAreaBreakdown["groups"]) {
  const map = new Map<
    string,
    {
      userId: string | null;
      name: string;
      avatarUrl: string | null;
      groups: NpsOutreachAreaBreakdown["groups"];
    }
  >();
  for (const group of groups) {
    const key = group.senderUserId ?? "__none__";
    const existing = map.get(key);
    if (existing) {
      existing.groups.push(group);
      continue;
    }
    map.set(key, {
      userId: group.senderUserId,
      name: group.senderName,
      avatarUrl: group.senderAvatarUrl,
      groups: [group],
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    if (Boolean(a.userId) !== Boolean(b.userId)) return a.userId ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function OutreachAreaBreakdown({
  metric,
  label,
  rows,
}: {
  metric: OutreachMetric;
  label: string;
  rows: NpsOutreachAreaBreakdown[];
}) {
  const [openArea, setOpenArea] = useState<string | null>(null);
  const sorted = [...rows].sort((a, b) => {
    if (b.eligibleGroups !== a.eligibleGroups) return b.eligibleGroups - a.eligibleGroups;
    return a.area.localeCompare(b.area, "pt-BR");
  });

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label} por área responsável</p>
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma área para exibir.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60">
          {sorted.map((row) => {
            const sentRatio =
              row.eligibleGroups > 0 ? Math.min(100, (row.sentGroups / row.eligibleGroups) * 100) : 0;
            const expanded = openArea === row.area;
            const senders = sendersForArea(row.groups);
            return (
              <li key={row.area} className="py-2 first:pt-1 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpenArea((current) => (current === row.area ? null : row.area))}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1",
                      getAreaIconStyle(row.area)
                    )}
                  >
                    <AreaIcon area={row.area} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{row.area}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.eligiblePeople} pessoas · {row.respondedPeople} respondidas
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[#347796]" style={{ width: `${sentRatio}%` }} />
                    </div>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {row.sentGroups}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      / {row.eligibleGroups}
                    </span>
                  </p>
                </button>
                {expanded && (
                  <ul className="mt-2 space-y-2 rounded-lg bg-muted/40 px-3 py-2">
                    {senders.length === 0 ? (
                      <li className="text-xs text-muted-foreground">Nenhum colaborador nesta área.</li>
                    ) : (
                      senders.map((sender) => {
                        const sentCount = sender.groups.filter((group) => group.sent).length;
                        return (
                          <li key={sender.userId ?? sender.name}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2">
                                <FilterUserAvatar
                                  name={sender.name}
                                  avatarUrl={sender.avatarUrl}
                                  size="sm"
                                />
                                <span className="truncate text-sm font-medium">{sender.name}</span>
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {sentCount}/{sender.groups.length} enviados
                              </span>
                            </div>
                            <ul className="mt-1 space-y-0.5 pl-9">
                              {sender.groups.map((group) => (
                                <li
                                  key={group.id}
                                  className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                                >
                                  <span className="min-w-0 truncate">{group.name}</span>
                                  <span className="shrink-0 tabular-nums">
                                    {group.sent ? "enviado" : "pendente"} ·{" "}
                                    {groupMetricValue(group, metric)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NpsOutreachBoard({ outreach }: { outreach: NpsOutreachProgress }) {
  const [openMetric, setOpenMetric] = useState<OutreachMetric | null>(null);
  const byArea = outreach.byArea ?? [];

  const cards: Array<{
    metric: OutreachMetric;
    label: string;
    value: number;
    total?: number;
    hint: string;
    icon: typeof Users;
  }> = [
    {
      metric: "eligiblePeople",
      label: "Pessoas Elegíveis",
      value: outreach.eligiblePeople,
      hint: "NPS sim ou ainda sem classificação",
      icon: UserCheck,
    },
    {
      metric: "eligibleGroups",
      label: "Grupos elegíveis",
      value: outreach.eligibleGroups,
      hint: "clientes ativos com pelo menos 1 pessoa sim ou pendente",
      icon: Building2,
    },
    {
      metric: "sentGroups",
      label: "Enviados",
      value: outreach.sentGroups,
      total: outreach.eligibleGroups,
      hint: "grupos com NPS enviado",
      icon: Send,
    },
    {
      metric: "respondedPeople",
      label: "Respondidos",
      value: outreach.respondedPeople,
      total: outreach.eligiblePeople,
      hint: "pessoas que já responderam",
      icon: Users,
    },
  ];

  const openCard = cards.find((card) => card.metric === openMetric) ?? null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <OutreachMeter
            key={card.metric}
            label={card.label}
            value={card.value}
            total={card.total}
            hint={card.hint}
            icon={card.icon}
            expanded={openMetric === card.metric}
            onToggle={() =>
              setOpenMetric((current) => (current === card.metric ? null : card.metric))
            }
          />
        ))}
      </div>
      {openCard && (
        <OutreachAreaBreakdown metric={openCard.metric} label={openCard.label} rows={byArea} />
      )}
    </div>
  );
}

function DimensionMeter({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, (value / 10) * 100));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", avgTone(value))}>
          {value == null ? "—" : value.toFixed(1)}
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            value == null
              ? "bg-muted"
              : value >= 9
                ? "bg-emerald-500"
                : value >= 7
                  ? "bg-amber-400"
                  : "bg-red-500"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">média · escala 0–10</p>
    </div>
  );
}

function NpsHero({ summary }: { summary: NpsScoreSummary }) {
  const tone = npsTone(summary.nps);
  const promotersPct = pct(summary.promoters, summary.total);
  const passivesPct = pct(summary.passives, summary.total);
  const detractorsPct = pct(summary.detractors, summary.total);

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl",
          tone === "good" && "bg-emerald-400/20",
          tone === "mid" && "bg-amber-400/20",
          tone === "bad" && "bg-red-400/20",
          tone === "empty" && "bg-slate-300/20"
        )}
      />

      <div className="relative grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex flex-col items-start sm:flex-row sm:items-end sm:gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Score NPS
            </p>
            <p
              className={cn(
                "mt-1 text-6xl font-bold tracking-tight tabular-nums sm:text-7xl",
                tone === "good" && "text-emerald-700",
                tone === "mid" && "text-amber-700",
                tone === "bad" && "text-red-700",
                tone === "empty" && "text-muted-foreground"
              )}
            >
              {summary.nps == null ? "—" : summary.nps}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              escala −100 a 100 · {summary.total} resposta{summary.total === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {summary.total > 0 ? (
              <>
                <div className="bg-emerald-500 transition-all" style={{ width: `${promotersPct}%` }} />
                <div className="bg-amber-400 transition-all" style={{ width: `${passivesPct}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${detractorsPct}%` }} />
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Promotores",
                count: summary.promoters,
                percent: promotersPct,
                hint: "9–10",
                className: "border-emerald-200/80 bg-emerald-50/80 text-emerald-900",
              },
              {
                label: "Neutros",
                count: summary.passives,
                percent: passivesPct,
                hint: "7–8",
                className: "border-amber-200/80 bg-amber-50/80 text-amber-900",
              },
              {
                label: "Detratores",
                count: summary.detractors,
                percent: detractorsPct,
                hint: "0–6",
                className: "border-red-200/80 bg-red-50/80 text-red-900",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn("rounded-xl border px-3 py-3 text-center", item.className)}
              >
                <p className="text-xl font-semibold tabular-nums">{item.count}</p>
                <p className="mt-0.5 text-[11px] font-medium">{item.label}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {item.percent}% · {item.hint}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-[4.5rem] flex-col rounded-lg border bg-background/80 px-2.5 py-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", avgTone(value))}>{value}</span>
    </div>
  );
}

function CommentBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3">
      <p className="text-[11px] font-medium leading-snug text-muted-foreground">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{body}</p>
    </div>
  );
}

function ResponseCard({ response }: { response: ResponseRow }) {
  const bucket = classifyNpsScore(response.scoreRecommend);

  return (
    <li className="px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{response.respondentName}</p>
            <Badge variant="outline" className={cn("text-[10px]", bucketBadgeClass(bucket))}>
              {bucketLabel(bucket)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">{response.groupName}</span>
            {response.respondentCargo ? ` · ${response.respondentCargo}` : ""}
            {" · "}
            {new Date(response.submittedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <div
          className={cn(
            "flex h-12 min-w-12 items-center justify-center rounded-xl border px-3 text-lg font-bold tabular-nums",
            bucketBadgeClass(bucket)
          )}
        >
          {response.scoreRecommend}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ScoreChip label="Disp." value={response.scoreAvailability} />
        <ScoreChip label="Comun." value={response.scoreCommunication} />
        <ScoreChip label="Inov." value={response.scoreInnovation} />
        <ScoreChip label="Técnica" value={response.scoreTechnical} />
      </div>

      {(response.reason || response.improvement) && (
        <div className="mt-3 space-y-2">
          {response.reason && (
            <CommentBlock title={`Motivo — ${RECOMMEND_QUESTION}`} body={response.reason} />
          )}
          {response.improvement && (
            <CommentBlock title={IMPROVEMENT_QUESTION} body={response.improvement} />
          )}
        </div>
      )}
    </li>
  );
}

export function NpsResultsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [campaignId, setCampaignId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("all");
  const [responseQuery, setResponseQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const load = useCallback(async (id?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = id ? `?campaignId=${encodeURIComponent(id)}` : "";
      const res = await fetch(`/api/nps/results${qs}`);
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          setData(null);
          setError(json.error ?? "Nenhuma campanha encontrada.");
          return;
        }
        throw new Error(json.error ?? "Erro ao carregar resultados.");
      }
      setData(json as ResultsPayload);
      setCampaignId((json as ResultsPayload).campaign.id);
      setGroupFilter("all");
      setResponseFilter("all");
      setResponseQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateCampaign() {
    const name = newCampaignName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/nps/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, activate: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao criar campanha.");
      setShowCreate(false);
      setNewCampaignName("");
      await load((json.campaign as NpsCampaign).id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSetStatus(status: "active" | "closed") {
    if (!data?.campaign) return;
    try {
      const res = await fetch(`/api/nps/campaigns/${data.campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao atualizar.");
      await load(data.campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  }

  const rankedGroups = useMemo(() => {
    if (!data) return [];
    return [...data.groups].sort((a, b) => {
      const aNps = a.summary.nps ?? -999;
      const bNps = b.summary.nps ?? -999;
      if (bNps !== aNps) return bNps - aNps;
      return b.responseCount - a.responseCount;
    });
  }, [data]);

  const chartData = useMemo(
    () =>
      rankedGroups.map((g) => ({
        name: g.groupName.replace(/^Grupo\s+/i, ""),
        fullName: g.groupName,
        nps: g.summary.nps ?? 0,
        respostas: g.responseCount,
        fill: scoreColor(g.summary.nps),
      })),
    [rankedGroups]
  );

  const filteredResponses = useMemo(() => {
    if (!data) return [];
    const q = responseQuery.trim().toLowerCase();
    return data.responses.filter((r) => {
      const bucket = classifyNpsScore(r.scoreRecommend);
      if (responseFilter !== "all" && bucket !== responseFilter) return false;
      if (groupFilter !== "all" && r.clientGroupId !== groupFilter) return false;
      if (!q) return true;
      return (
        r.respondentName.toLowerCase().includes(q) ||
        r.groupName.toLowerCase().includes(q) ||
        (r.reason ?? "").toLowerCase().includes(q) ||
        (r.improvement ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, responseFilter, groupFilter, responseQuery]);

  const commentsOnlyCount = useMemo(() => {
    if (!data) return 0;
    return data.responses.filter((r) => r.reason || r.improvement).length;
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/meus-clientes"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para Meus Clientes
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <MessageSquareHeart className="h-6 w-6 text-[#347796]" />
            Resultados NPS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada da satisfação por campanha, grupo e comentários.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(campaignId || undefined)}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Atualizar
          </Button>
          {data?.isAdmin && (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nova campanha
            </Button>
          )}
        </div>
      </div>

      {showCreate && data?.isAdmin && (
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <Label htmlFor="campaign-name">Nome da campanha</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="campaign-name"
              placeholder="Ex.: NPS 2026"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              className="max-w-sm"
            />
            <Button
              disabled={creating || !newCampaignName.trim()}
              onClick={() => void handleCreateCampaign()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar e ativar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A campanha será ativada imediatamente (a campanha ativa anterior será encerrada).
          </p>
        </div>
      )}

      {data && data.campaigns.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card/60 p-3 sm:p-4">
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Select
              value={campaignId}
              onValueChange={(v) => {
                setCampaignId(v);
                void load(v);
              }}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {data.campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.status === "active"
                      ? " (ativa)"
                      : c.status === "closed"
                        ? " (encerrada)"
                        : " (rascunho)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge
            variant="outline"
            className={
              data.campaign.status === "active"
                ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                : "text-muted-foreground"
            }
          >
            {data.campaign.status === "active"
              ? "Ativa"
              : data.campaign.status === "closed"
                ? "Encerrada"
                : "Rascunho"}
          </Badge>
          {data.isAdmin && data.campaign.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => void handleSetStatus("closed")}>
              Encerrar campanha
            </Button>
          )}
          {data.isAdmin && data.campaign.status !== "active" && (
            <Button variant="outline" size="sm" onClick={() => void handleSetStatus("active")}>
              Ativar campanha
            </Button>
          )}
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {data.groups.length} grupo{data.groups.length === 1 ? "" : "s"} com resposta
            </span>
            <span>{commentsOnlyCount} com comentário</span>
          </div>
        </div>
      )}

      {data && <NpsOutreachBoard outreach={data.outreach} />}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && error && !data && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie a primeira campanha para começar a gerar links nos grupos.
          </p>
        </div>
      )}

      {!loading && error && data && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && data && (
        <>
          <NpsHero summary={data.summary} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <DimensionMeter label="Recomendação" value={data.dimensions.recommend} />
            <DimensionMeter label="Disponibilidade" value={data.dimensions.availability} />
            <DimensionMeter label="Comunicação" value={data.dimensions.communication} />
            <DimensionMeter label="Inovação" value={data.dimensions.innovation} />
            <DimensionMeter label="Competência técnica" value={data.dimensions.technical} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {chartData.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-3">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">NPS por grupo</h2>
                    <p className="text-xs text-muted-foreground">
                      Barras coloridas por faixa de score
                    </p>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ left: 4, right: 8, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-18}
                        textAnchor="end"
                        height={64}
                      />
                      <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} width={42} />
                      <Tooltip
                        formatter={(value) => [`${value}`, "NPS"]}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as
                            | { fullName?: string }
                            | undefined;
                          return item?.fullName ?? "";
                        }}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="nps" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell key={entry.fullName} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {rankedGroups.length > 0 && (
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden lg:col-span-2">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold">Ranking</h2>
                  <p className="text-xs text-muted-foreground">Ordenado pelo NPS do grupo</p>
                </div>
                <ol className="max-h-[320px] divide-y overflow-y-auto">
                  {rankedGroups.map((g, index) => {
                    const tone = npsTone(g.summary.nps);
                    return (
                      <li
                        key={g.clientGroupId}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{g.groupName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {g.responseCount} resposta{g.responseCount === 1 ? "" : "s"}
                            {g.summary.promoters > 0
                              ? ` · ${g.summary.promoters} promotor${g.summary.promoters === 1 ? "" : "es"}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-base font-bold tabular-nums",
                            tone === "good" && "text-emerald-700",
                            tone === "mid" && "text-amber-700",
                            tone === "bad" && "text-red-700",
                            tone === "empty" && "text-muted-foreground"
                          )}
                        >
                          {g.summary.nps ?? "—"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>

          {rankedGroups.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Detalhe por grupo</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">#</th>
                      <th className="px-4 py-2.5 font-medium">Grupo</th>
                      <th className="px-4 py-2.5 font-medium">NPS</th>
                      <th className="px-4 py-2.5 font-medium">Respostas</th>
                      <th className="px-4 py-2.5 font-medium">P / N / D</th>
                      <th className="px-4 py-2.5 font-medium">Disp.</th>
                      <th className="px-4 py-2.5 font-medium">Comun.</th>
                      <th className="px-4 py-2.5 font-medium">Inov.</th>
                      <th className="px-4 py-2.5 font-medium">Técnica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedGroups.map((g, index) => {
                      const tone = npsTone(g.summary.nps);
                      return (
                        <tr key={g.clientGroupId} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2.5 font-medium">{g.groupName}</td>
                          <td
                            className={cn(
                              "px-4 py-2.5 tabular-nums font-semibold",
                              tone === "good" && "text-emerald-700",
                              tone === "mid" && "text-amber-700",
                              tone === "bad" && "text-red-700"
                            )}
                          >
                            {g.summary.nps ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{g.responseCount}</td>
                          <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                            <span className="text-emerald-700">{g.summary.promoters}</span>
                            {" / "}
                            <span className="text-amber-700">{g.summary.passives}</span>
                            {" / "}
                            <span className="text-red-700">{g.summary.detractors}</span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {g.dimensions.availability?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {g.dimensions.communication?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {g.dimensions.innovation?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {g.dimensions.technical?.toFixed(1) ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="space-y-3 border-b px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    Respostas e comentários
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({filteredResponses.length}
                      {filteredResponses.length !== data.responses.length
                        ? ` de ${data.responses.length}`
                        : ""}
                      )
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Filtre por tipo, grupo ou busque no texto dos comentários
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "all", label: "Todas" },
                    { id: "promoter", label: "Promotores" },
                    { id: "passive", label: "Neutros" },
                    { id: "detractor", label: "Detratores" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setResponseFilter(item.id)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      responseFilter === item.id
                        ? "border-[#347796] bg-[#347796] text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </button>
                ))}

                <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={responseQuery}
                    onChange={(e) => setResponseQuery(e.target.value)}
                    placeholder="Buscar nome, grupo ou comentário…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os grupos</SelectItem>
                    {rankedGroups.map((g) => (
                      <SelectItem key={g.clientGroupId} value={g.clientGroupId}>
                        {g.groupName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {data.responses.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Ainda não há respostas nesta campanha.
              </p>
            ) : filteredResponses.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma resposta com os filtros atuais.
              </p>
            ) : (
              <ul className="divide-y">
                {filteredResponses.map((r) => (
                  <ResponseCard key={r.id} response={r} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
