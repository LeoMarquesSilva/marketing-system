"use client";

import {
  Award,
  BadgeCheck,
  Clock,
  Coins,
  Compass,
  GraduationCap,
  Handshake,
  HeartHandshake,
  HeartPulse,
  Megaphone,
  Scale,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import {
  FAVORABLE_TARGET,
  favorability,
  getCriticity,
  type Favorability,
  type PersonRef,
} from "@/lib/clima-metrics";
import { SCORE_LABELS, type ActionPlan } from "@/lib/clima-types";
import { cn } from "@/lib/utils";

/** [DT, D, N, C, CT]: vermelho ↔ azul da marca, cinza no meio */
export const LIKERT_COLORS = ["#b42318", "#f19a8e", "#c3cbd2", "#8ec3d8", "#347796"] as const;

const BAND_COLORS = { favorable: "#347796", neutral: "#c3cbd2", unfavorable: "#c8473c" };

const DIMENSION_ICONS: Record<string, LucideIcon> = {
  credibilidade: BadgeCheck,
  respeito: HeartHandshake,
  imparcialidade: Scale,
  orgulho: Trophy,
  camaradagem: Users,
};

const THEME_ICONS: Record<string, LucideIcon> = {
  comunicacao: Megaphone,
  competencia: Compass,
  integridade: ShieldCheck,
  apoio: GraduationCap,
  cuidado: HeartPulse,
  reconhecimento: Award,
  equilibrio: Clock,
  remuneracao: Coins,
  meritocracia: TrendingUp,
  diversidade: UsersRound,
  "proposito-trabalho": Target,
  relacoes: Handshake,
};

export function DimensionIcon({ id, className }: { id: string; className?: string }) {
  const Icon = DIMENSION_ICONS[id] ?? BadgeCheck;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}

/** Ícone do tema dentro de um quadrado claro, para listas e cards */
export function ThemeIcon({ id, className }: { id: string; className?: string }) {
  const Icon = THEME_ICONS[id] ?? Target;
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#47cdd0]/15 text-[#285f7a]",
        className
      )}
      aria-hidden
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

const CRITICITY_PILL = {
  critico: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  atencao: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  bom: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export function FavorabilityPill({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        CRITICITY_PILL[getCriticity(value)],
        className
      )}
    >
      {Math.round(value)}% favorável
    </span>
  );
}

export function favorableTextClass(value: number) {
  const c = getCriticity(value);
  return c === "critico"
    ? "text-red-700 dark:text-red-300"
    : c === "atencao"
      ? "text-amber-800 dark:text-amber-300"
      : "text-foreground";
}

/** Favorável | neutro | desfavorável, com a linha da referência de 70% */
export function FavorabilityBar({
  value,
  className,
}: {
  value: Favorability;
  className?: string;
}) {
  const label = `${Math.round(value.favorable)}% favorável, ${Math.round(value.neutral)}% neutro, ${Math.round(value.unfavorable)}% desfavorável`;
  return (
    <div
      className={cn("relative h-3 w-full", className)}
      role="img"
      aria-label={label}
      title={label}
    >
      <div className="flex h-full w-full gap-[2px] overflow-hidden rounded-[4px] bg-muted">
        {value.favorable > 0 && (
          <div style={{ width: `${value.favorable}%`, background: BAND_COLORS.favorable }} />
        )}
        {value.neutral > 0 && (
          <div style={{ width: `${value.neutral}%`, background: BAND_COLORS.neutral }} />
        )}
        {value.unfavorable > 0 && (
          <div style={{ width: `${value.unfavorable}%`, background: BAND_COLORS.unfavorable }} />
        )}
      </div>
      <div
        className="absolute -top-1 -bottom-1 border-l-2 border-dashed border-foreground/70"
        style={{ left: `${FAVORABLE_TARGET}%` }}
        aria-hidden
      />
    </div>
  );
}

export function FavorabilityLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <LegendSwatch color={BAND_COLORS.favorable} label="Favorável" />
      <LegendSwatch color={BAND_COLORS.neutral} label="Neutro" />
      <LegendSwatch color={BAND_COLORS.unfavorable} label="Desfavorável" />
      <span className="flex items-center gap-1.5">
        <span className="h-3 border-l-2 border-dashed border-foreground/70" aria-hidden />
        Referência de {FAVORABLE_TARGET}%
      </span>
    </div>
  );
}

/**
 * Barra divergente (Heiberger e Robbins): discordância à esquerda do eixo,
 * concordância à direita e o neutro dividido ao meio. Escala fixa de 100%
 * para cada lado, para as linhas serem comparáveis entre si.
 */
export function DivergingBar({ scores, className }: { scores: number[]; className?: string }) {
  const total = scores.reduce((a, b) => a + b, 0) || 1;
  const pct = [0, 1, 2, 3, 4].map((i) => ((scores[i] ?? 0) / total) * 100);
  // cada lado vai de 0 a 100%, então 1 ponto percentual = 0,5% da largura
  const start = 50 - (pct[0] + pct[1] + pct[2] / 2) / 2;
  const present = pct.map((v, i) => ({ v, i })).filter((s) => s.v > 0);
  const f = favorability(scores);
  const label = `${Math.round(f.unfavorable)}% discorda, ${Math.round(f.neutral)}% neutro, ${Math.round(f.favorable)}% concorda`;
  let offset = start;
  return (
    <div className={cn("relative h-3 w-full", className)} role="img" aria-label={label} title={label}>
      <div className="absolute inset-0 rounded-[4px] bg-muted/60" aria-hidden />
      {present.map(({ v, i }, n) => {
        const left = offset;
        offset += v / 2;
        return (
          <div
            key={i}
            aria-hidden
            className={cn(
              "absolute inset-y-0",
              n > 0 && "border-l-2 border-background",
              n === 0 && "rounded-l-[4px]",
              n === present.length - 1 && "rounded-r-[4px]"
            )}
            style={{ left: `${left}%`, width: `${v / 2}%`, background: LIKERT_COLORS[i] }}
          />
        );
      })}
      <div className="absolute -top-1 -bottom-1 left-1/2 border-l border-foreground/50" aria-hidden />
    </div>
  );
}

export function LikertLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {SCORE_LABELS.map((label, i) => (
        <LegendSwatch key={label} color={LIKERT_COLORS[i]} label={label} />
      ))}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

/** Fotos dos responsáveis; grupos ("Gestores") aparecem com ícone */
export function PeopleAvatars({ people, className }: { people: PersonRef[]; className?: string }) {
  if (people.length === 0) return null;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="flex -space-x-2">
        {people.map((p) =>
          p.kind === "pessoa" ? (
            <EmployeeAvatar
              key={p.name}
              name={p.name}
              avatarUrl={p.avatarUrl}
              className="h-7 w-7 ring-2 ring-background"
            />
          ) : (
            <span
              key={p.name}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background"
              aria-hidden
            >
              <Users className="h-3.5 w-3.5" />
            </span>
          )
        )}
      </span>
      <span className="truncate text-sm text-foreground">
        {people
          .map((p) => (p.kind === "pessoa" ? p.name.split(" ").slice(0, 2).join(" ") : p.name))
          .join(", ")}
      </span>
    </span>
  );
}

const PLAN_STATUS: Record<ActionPlan["status"], { label: string; className: string }> = {
  backlog: { label: "Não iniciado", className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-[#47cdd0]/18 text-[#285f7a]" },
  concluido: { label: "Concluído", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

export function PlanStatusBadge({ status }: { status: ActionPlan["status"] }) {
  const cfg = PLAN_STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}
