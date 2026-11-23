"use client";

/**
 * Peças da tela de Métricas do Site (GA4): ícone por canal e por tipo de
 * página, selo de variação e linha de ranking com barra.
 */
import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Building2,
  CircleHelp,
  FileText,
  Globe,
  Handshake,
  Home,
  Link2,
  Mail,
  Megaphone,
  MessageSquareText,
  Minus,
  MousePointerClick,
  Scale,
  Search,
  Share2,
  Sparkles,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deltaPercent, formatDelta } from "@/lib/social-metrics/format";
import { GA4_PAGE_KIND_LABELS, classifyGa4PagePath, type Ga4PageKind } from "@/lib/ga4-analytics";

/* ------------------------------------------------------------- ícones */

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  Direct: MousePointerClick,
  "Organic Search": Search,
  "Paid Search": Megaphone,
  "Organic Social": Share2,
  "Paid Social": Megaphone,
  Referral: Link2,
  Email: Mail,
  Affiliates: Handshake,
  Display: Megaphone,
  "Organic Video": Video,
  "Paid Video": Video,
  "Cross-network": Megaphone,
  "AI Assistant": Sparkles,
  Unassigned: CircleHelp,
  "(não definido)": CircleHelp,
};

export function ga4ChannelIcon(channelGroup: string): LucideIcon {
  return CHANNEL_ICONS[channelGroup] ?? Globe;
}

const PAGE_KIND_ICONS: Record<Ga4PageKind, LucideIcon> = {
  inicio: Home,
  contato: MessageSquareText,
  area: Scale,
  conteudo: BookOpen,
  equipe: UsersRound,
  carreiras: Briefcase,
  institucional: Building2,
  outra: FileText,
};

export function ga4PageKindOf(path: string): { kind: Ga4PageKind; label: string; icon: LucideIcon } {
  const kind = classifyGa4PagePath(path);
  return { kind, label: GA4_PAGE_KIND_LABELS[kind], icon: PAGE_KIND_ICONS[kind] };
}

/* ---------------------------------------------------------- variação */

export function DeltaChip({
  current,
  previous,
  compareLabel,
  previousText,
  className,
}: {
  current: number | null;
  previous: number | null;
  compareLabel: string;
  previousText?: string;
  className?: string;
}) {
  const delta = deltaPercent(current, previous);
  const value = delta ?? 0;
  const flat = delta === null || Math.abs(value) < 0.5;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
            flat ? "bg-[#f1f5f7] text-[#4a6470]" : value > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            className
          )}
        >
          <Icon className="size-3" aria-hidden />
          {formatDelta(delta)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {delta === null ? `Sem base para comparar em ${compareLabel}.` : `${compareLabel}: ${previousText ?? "—"}`}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------- linha de ranking */

export function RankRow({
  icon: Icon,
  iconLabel,
  iconTone = "default",
  title,
  subtitle,
  badge,
  value,
  valueSub,
  ratio,
  color,
  onOpen,
}: {
  icon: LucideIcon;
  iconLabel: string;
  iconTone?: "default" | "warning";
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  value: string;
  valueSub?: React.ReactNode;
  /** 0–1: tamanho da barra em relação ao maior da lista. */
  ratio: number;
  color: string;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          iconTone === "warning" ? "bg-amber-50 text-amber-700" : "bg-[#eef6f8] text-[#285f7a]"
        )}
        title={iconLabel}
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{iconLabel}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-[#10232d]">{title}</span>
          {badge}
        </span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
        <span className="mt-1.5 block h-1.5 rounded-full bg-[#eef3f5]" aria-hidden>
          <span
            className="block h-1.5 rounded-full"
            style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, background: color }}
          />
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm font-semibold text-[#10232d]">{value}</span>
        {valueSub && <span className="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">{valueSub}</span>}
      </span>
    </>
  );

  const className = "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left";
  return (
    <li>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            className,
            "transition-colors hover:bg-[#f4fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
          )}
        >
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

/** Selo âmbar "atípico" para local com cara de robô. */
export function SuspectBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
          atípico
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        Padrão típico de tráfego automatizado (robô ou data center), não de público real.
      </TooltipContent>
    </Tooltip>
  );
}
