"use client";

import { createElement } from "react";
import { AlarmClock, CircleDashed, Crown, GraduationCap, Hammer, MessagesSquare, Target, type LucideIcon } from "lucide-react";
import { civilKeyFromLabel, civilSealSrc } from "@/lib/rh/pdi/civil";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { getInitials } from "@/lib/ferias/filters";
import { dueLabel } from "@/lib/rh/pdi/progress";
import {
  PDI_LEARNING_KINDS,
  PDI_LEARNING_KIND_ORDER,
  type PdiDueState,
  type PdiKindCount,
  type PdiLearningKind,
  type PdiPerson,
  type PdiStatus,
} from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { Hint } from "../hint";

/* ------------------------------------------------------------- linguagem */

/** Mesma linguagem da tela inicial (inicio-client): superfície, tons de texto e dourado. */
export const SURFACE = "rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.05)]";
export const GOLD = "#E1B16D";
export const INK = "text-[#0d2a38]";
export const BODY = "text-[#3b5560]";
export const MUTED = "text-[#5a717b]";

/** Bloco de número com ícone (igual aos da tela inicial). */
export function StatTile({
  icon: Icon,
  value,
  label,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  hint?: string;
  tone: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-2xl font-semibold leading-none tabular-nums", INK)}>{value}</span>
        <span className={cn("mt-1 block truncate text-sm", BODY)}>{label}</span>
        {hint && <span className={cn("block truncate text-xs", MUTED)}>{hint}</span>}
      </span>
    </>
  );
  const className = cn(
    SURFACE,
    "flex min-h-[76px] w-full items-center gap-3.5 px-4 py-3.5 text-left",
    onClick && "outline-none transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
    active && "border-[#347796] ring-1 ring-[#347796]"
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Selo oficial do valor CIVIL (o do BP Awards) ou ícone neutro quando a frente não tem valor. */
export function CivilSeal({ competency, className }: { competency: string | null; className?: string }) {
  const key = civilKeyFromLabel(competency);
  const src = key ? civilSealSrc(key) : null;
  // Selos desenhados para fundo escuro (como no BP Awards): base azul-marinho.
  if (src) {
    return (
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-lg bg-[#0f1f2e] p-0.5", className)} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-lg",
        key === "lideranca" ? "bg-[#0f1f2e] text-[#E1B16D]" : "bg-[#eef3f5] text-[#48466e]",
        className
      )}
      aria-hidden
    >
      {key === "lideranca" ? <Crown className="size-5" /> : <Target className="size-5" />}
    </span>
  );
}

/* ------------------------------------------------------------------ datas */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
}

/** "hoje", "ontem", "há 5 dias", "há 2 meses". */
export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 45) return `há ${days} dias`;
  // Meses completos: 51 dias é "há 1 mês" (antes arredondava para 2).
  const months = Math.floor(days / 30);
  return months <= 1 ? "há 1 mês" : `há ${months} meses`;
}

/* ----------------------------------------------------------------- pessoas */

const AVATAR_SIZE = {
  xs: "size-6 text-xs tracking-tight",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
} as const;

export function PersonPhoto({
  person,
  size = "sm",
  className,
}: {
  person: Pick<PdiPerson, "name" | "avatar_url"> | null;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
}) {
  const name = person?.name ?? "?";
  return (
    <Hint label={person?.name}>
      <Avatar className={cn("shrink-0 ring-1 ring-black/5", AVATAR_SIZE[size], className)}>
        {person?.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
        <AvatarFallback className="bg-[#e8f1f5] font-semibold text-[#315f73]">{getInitials(name)}</AvatarFallback>
      </Avatar>
    </Hint>
  );
}

export function AreaTile({ area, className }: { area: string | null; className?: string }) {
  if (!area) return null;
  return (
    <Hint label={area}>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-md ring-1 ring-inset", getAreaIconStyle(area), className)} aria-hidden>
        {createElement(getAreaIcon(area), { className: "size-3.5", "aria-hidden": true })}
      </span>
    </Hint>
  );
}

/** Foto + nome + cargo · área. */
export function PersonLine({
  person,
  size = "sm",
  extra,
  className,
}: {
  person: PdiPerson;
  size?: keyof typeof AVATAR_SIZE;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <PersonPhoto person={person} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{person.name}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {person.department && <AreaTile area={person.department} className="size-4 rounded [&_svg]:size-3" />}
          <span className="truncate">{[person.position, person.department].filter(Boolean).join(" · ") || "—"}</span>
        </span>
        {extra}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- 70-20-10 */

const KIND_ICONS: Record<PdiLearningKind, LucideIcon> = {
  pratica: Hammer,
  troca: MessagesSquare,
  formal: GraduationCap,
};

/** Cores do 70-20-10: tons da marca (azul, ciano, índigo), sem cor de estado. */
export const KIND_STYLES: Record<PdiLearningKind | "sem", { tile: string; bar: string }> = {
  pratica: { tile: "bg-[#e6f0f5] text-[#285f7a]", bar: "bg-[#347796]" },
  troca: { tile: "bg-[#e3f7f7] text-[#1f7f82]", bar: "bg-[#47cdd0]" },
  formal: { tile: "bg-[#ecebf3] text-[#48466e]", bar: "bg-[#48466e]" },
  sem: { tile: "bg-muted text-muted-foreground", bar: "bg-[#c9d6da]" },
};

export function KindIcon({ kind, className }: { kind: PdiLearningKind | null; className?: string }) {
  const style = KIND_STYLES[kind ?? "sem"];
  return (
    <Hint label={kind ? `${PDI_LEARNING_KINDS[kind].share} · ${PDI_LEARNING_KINDS[kind].label}` : "Sem tipo 70-20-10"}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", style.tile, className)} aria-hidden>
        {createElement(kind ? KIND_ICONS[kind] : CircleDashed, { className: "size-4", "aria-hidden": true })}
      </span>
    </Hint>
  );
}

export function kindIconOf(kind: PdiLearningKind): LucideIcon {
  return KIND_ICONS[kind];
}

/** Barra empilhada com a mistura 70-20-10 do plano. */
export function KindMix({ kinds, className }: { kinds: PdiKindCount; className?: string }) {
  const total = kinds.pratica + kinds.troca + kinds.formal + kinds.sem;
  if (total === 0) return null;
  const parts = [...PDI_LEARNING_KIND_ORDER, "sem" as const].filter((key) => kinds[key] > 0);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Mistura 70-20-10 das ações">
        {parts.map((key) => (
          <span key={key} className={cn("h-full", KIND_STYLES[key].bar)} style={{ width: `${(kinds[key] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", KIND_STYLES[key].bar)} aria-hidden />
            {key === "sem" ? "Sem tipo" : `${PDI_LEARNING_KINDS[key].label} (${PDI_LEARNING_KINDS[key].share})`}
            <span className="tabular-nums text-foreground">{Math.round((kinds[key] / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- progresso */

export function ProgressBar({
  value,
  size = "md",
  tone = "default",
  className,
  label,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "done" | "late";
  className?: string;
  label?: string;
}) {
  const height = size === "lg" ? "h-2.5" : size === "sm" ? "h-1.5" : "h-2";
  const fill = tone === "done" ? "bg-emerald-600" : tone === "late" ? "bg-amber-500" : "bg-[#347796]";
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-[#e3edf0]", height, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label ?? "Progresso"}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fill)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function progressTone(value: number, dueState: PdiDueState): "default" | "done" | "late" {
  if (value >= 100 || dueState === "concluido") return "done";
  if (dueState === "atrasado") return "late";
  return "default";
}

/* ------------------------------------------------------------------- prazo */

const DUE_STYLES: Record<PdiDueState, string> = {
  em_dia: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  vence_em_breve: "bg-amber-50 text-amber-800 ring-amber-600/20",
  atrasado: "bg-red-50 text-red-800 ring-red-600/20",
  concluido: "bg-[#e6f0f5] text-[#285f7a] ring-[#347796]/15",
  cancelado: "bg-muted text-muted-foreground ring-border",
};

export function DueBadge({
  state,
  daysLeft,
  status,
  className,
}: {
  state: PdiDueState;
  daysLeft: number;
  status: PdiStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        DUE_STYLES[state],
        className
      )}
    >
      {state === "atrasado" && <AlarmClock className="size-3" aria-hidden />}
      {dueLabel(daysLeft, status)}
    </span>
  );
}
