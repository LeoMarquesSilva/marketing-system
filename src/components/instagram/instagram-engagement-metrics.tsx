"use client";

import { Eye, Heart, MessageCircle, Bookmark, TrendingUp } from "lucide-react";
import {
  computeEngagementRate,
  ENGAGEMENT_RATE_FORMULA_SHORT,
  formatEngagementRate,
} from "@/lib/instagram-engagement";
import { cn } from "@/lib/utils";

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

interface InstagramEngagementMetricsProps {
  likes: number;
  comments: number;
  saves: number;
  reach: number;
  /** compact = linha única; default = bloco destacado */
  variant?: "default" | "compact" | "hero";
  className?: string;
}

export function InstagramEngagementMetrics({
  likes,
  comments,
  saves,
  reach,
  variant = "default",
  className,
}: InstagramEngagementMetricsProps) {
  const rate = computeEngagementRate(likes, comments, saves, reach);
  const actions = likes + comments + saves;

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
        <span className="font-semibold text-foreground" title={ENGAGEMENT_RATE_FORMULA_SHORT}>
          {formatEngagementRate(rate)} engajamento
        </span>
        <span>{formatNumber(reach)} alcance</span>
        <span>{formatNumber(likes)} curtidas</span>
        <span>{formatNumber(comments)} comentários</span>
        <span>{formatNumber(saves)} salvamentos</span>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "rounded-xl border border-[#04202f]/10 bg-[#04202f]/[0.04] p-4",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Taxa de engajamento
            </p>
            <p className="text-3xl font-bold tabular-nums text-[#04202f]">
              {formatEngagementRate(rate)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5 max-w-md">
              {ENGAGEMENT_RATE_FORMULA_SHORT}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{formatNumber(actions)} ações de engajamento</p>
            <p>÷ {formatNumber(reach)} alcance</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <MetricChip icon={<Eye className="h-3.5 w-3.5" />} label="Alcance" value={formatNumber(reach)} />
          <MetricChip icon={<Heart className="h-3.5 w-3.5" />} label="Curtidas" value={formatNumber(likes)} />
          <MetricChip icon={<MessageCircle className="h-3.5 w-3.5" />} label="Comentários" value={formatNumber(comments)} />
          <MetricChip icon={<Bookmark className="h-3.5 w-3.5" />} label="Salvamentos" value={formatNumber(saves)} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl bg-black/[0.03] px-3 py-3 space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Taxa de engajamento
          </span>
        </div>
        <span className="text-sm font-bold tabular-nums">{formatEngagementRate(rate)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{ENGAGEMENT_RATE_FORMULA_SHORT}</p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <MetricChip icon={<Eye className="h-3 w-3" />} label="Alcance" value={formatNumber(reach)} small />
        <MetricChip icon={<Heart className="h-3 w-3" />} label="Curtidas" value={formatNumber(likes)} small />
        <MetricChip icon={<MessageCircle className="h-3 w-3" />} label="Comentários" value={formatNumber(comments)} small />
        <MetricChip icon={<Bookmark className="h-3 w-3" />} label="Salvamentos" value={formatNumber(saves)} small />
      </div>
    </div>
  );
}

export function InstagramPostEngagementMetrics({
  post,
  variant = "default",
  className,
}: {
  post: { likes: number; comments: number; saves: number; reach: number };
  variant?: "default" | "compact" | "hero";
  className?: string;
}) {
  return (
    <InstagramEngagementMetrics
      likes={post.likes}
      comments={post.comments}
      saves={post.saves}
      reach={post.reach}
      variant={variant}
      className={className}
    />
  );
}

function MetricChip({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className={cn("rounded-lg bg-white/70 px-2.5 py-2 border border-border/30", small && "py-1.5")}>
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className={cn("font-semibold tabular-nums", small ? "text-sm" : "text-base")}>{value}</p>
    </div>
  );
}
