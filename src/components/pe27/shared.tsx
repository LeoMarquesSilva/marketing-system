"use client";

import { Handshake, Landmark, ShieldAlert, UsersRound, type LucideIcon } from "lucide-react";
import { PersonFace } from "@/components/pesquisas/shared";
import { cn } from "@/lib/utils";
import {
  DECISION_LABELS,
  DIMENSIONS,
  normalizeForSearch,
  staysInPlan,
  type Decision,
  type Dimension,
  type Pe27Lever,
  type Pe27Person,
} from "@/lib/pe27/types";
import { PE27_TEMAS } from "@/lib/pe27/conteudo";

export { PersonFace, requestJson, plural, ProgressBar } from "@/components/pesquisas/shared";

export const DIMENSION_ICONS: Record<Dimension, LucideIcon> = {
  clientes: Handshake,
  pessoas: UsersRound,
  acionistas: Landmark,
};

/** Tom de cada dimensão: azul da marca, ciano escurecido e índigo (DESIGN.md). */
export const DIMENSION_TONES: Record<Dimension, { tile: string; text: string; soft: string }> = {
  clientes: { tile: "bg-[#e4f0f6] text-[#2c6a89]", text: "text-[#2c6a89]", soft: "bg-[#f2f8fb]" },
  pessoas: { tile: "bg-[#def4f4] text-[#18777a]", text: "text-[#18777a]", soft: "bg-[#f0fafa]" },
  acionistas: { tile: "bg-[#ebeaf3] text-[#48466e]", text: "text-[#48466e]", soft: "bg-[#f5f5f9]" },
};

export function DimensionTile({ dimension, size = "md" }: { dimension: Dimension; size?: "sm" | "md" | "lg" }) {
  const Icon = DIMENSION_ICONS[dimension];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        DIMENSION_TONES[dimension].tile,
        size === "sm" && "size-7",
        size === "md" && "size-10",
        size === "lg" && "size-12",
      )}
      aria-hidden
    >
      <Icon className={cn(size === "sm" ? "size-3.5" : size === "md" ? "size-5" : "size-6")} />
    </span>
  );
}

const DECISION_STYLE: Record<Decision, string> = {
  em_analise: "bg-slate-50 text-slate-600 ring-slate-200",
  mantida: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  ajustada: "bg-[#e9f3f8] text-[#285f7a] ring-[#3e84a8]/30",
  juntada: "bg-[#48466e]/8 text-[#48466e] ring-[#48466e]/25",
  descartada: "bg-rose-50 text-rose-700 ring-rose-200",
};

const DECISION_DOT: Record<Decision, string> = {
  em_analise: "bg-slate-400",
  mantida: "bg-emerald-500",
  ajustada: "bg-[#347796]",
  juntada: "bg-[#48466e]",
  descartada: "bg-rose-500",
};

export function DecisionBadge({ status, className }: { status: Decision; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        DECISION_STYLE[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DECISION_DOT[status])} aria-hidden />
      {DECISION_LABELS[status]}
    </span>
  );
}

/** Foto + nome curto, com a área ou o papel embaixo. */
export function PersonLine({ person, detail, badge }: { person: Pe27Person; detail?: string | null; badge?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PersonFace person={person} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-sm leading-5 font-medium text-foreground">
          <span className="truncate">{person.short_name}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-[#fdf3e3] px-1.5 py-px text-xs leading-4 font-semibold text-[#8a6224]">{badge}</span>
          )}
        </p>
        {detail && <p className="truncate text-xs leading-4 text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

export function Pe27AcessoNegado() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-[#dce9eb] bg-white px-6 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldAlert className="size-5" aria-hidden />
      </span>
      <div>
        <p className="font-semibold text-foreground">Acesso restrito</p>
        <p className="mt-1 text-sm text-muted-foreground">O PE27 está aberto só para administradores por enquanto.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- contagens */

export interface DecisionCounts {
  total: number;
  decided: number;
  inPlan: number;
  byStatus: Record<Decision, number>;
}

function emptyCounts(): DecisionCounts {
  return { total: 0, decided: 0, inPlan: 0, byStatus: { em_analise: 0, mantida: 0, ajustada: 0, juntada: 0, descartada: 0 } };
}

function add(counts: DecisionCounts, status: Decision) {
  counts.total += 1;
  counts.byStatus[status] += 1;
  if (status !== "em_analise") counts.decided += 1;
  if (staysInPlan(status)) counts.inPlan += 1;
}

/** Alavancas e metas contadas separadamente (o "tamanho do plano" é por alavanca). */
export function countDecisions(levers: Pe27Lever[]): { levers: DecisionCounts; goals: DecisionCounts } {
  const result = { levers: emptyCounts(), goals: emptyCounts() };
  for (const lever of levers) {
    add(result.levers, lever.status);
    for (const goal of lever.goals) add(result.goals, goal.status);
  }
  return result;
}

/* ------------------------------------------------------------- temas comuns */

export interface SharedTheme {
  label: string;
  hits: Array<{ dimension: Dimension; text: string }>;
  dimensions: Dimension[];
}

/** Temas (busca literal) que apareceram em mais de uma dimensão. Descartados não contam. */
export function findSharedThemes(levers: Pe27Lever[]): SharedTheme[] {
  const entries = levers.flatMap((lever) => {
    const own = lever.status === "descartada" ? [] : [{ dimension: lever.dimension, text: lever.title }];
    const goals = lever.goals
      .filter((goal) => goal.status !== "descartada")
      .map((goal) => ({ dimension: lever.dimension, text: goal.text }));
    return [...own, ...goals];
  });
  return PE27_TEMAS.flatMap((theme) => {
    const hits = entries.filter((entry) => {
      const text = ` ${normalizeForSearch(entry.text)}`;
      return theme.terms.some((term) => text.includes(term));
    });
    const dimensions = DIMENSIONS.filter((dimension) => hits.some((hit) => hit.dimension === dimension));
    return dimensions.length > 1 ? [{ label: theme.label, hits, dimensions }] : [];
  }).sort((a, b) => b.dimensions.length - a.dimensions.length || b.hits.length - a.hits.length);
}
