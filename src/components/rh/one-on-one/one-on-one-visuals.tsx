"use client";

import { createElement } from "react";

import { AlarmClock, BarChart3, CalendarClock, CheckCircle2, CircleSlash, ClipboardCheck, HeartHandshake, ListChecks, MessagesSquare, Sparkles, Sprout, Target, TrendingUp, type LucideIcon } from "lucide-react";
import type { OneOnOneCadence, OneOnOneDisplayStatus } from "@/lib/rh/one-on-one/types";
import { cn } from "@/lib/utils";
import { Hint } from "../hint";

const TZ = "America/Sao_Paulo";

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatDayLong(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" }).format(new Date(iso));
}

export function formatDayShort(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" }).format(new Date(iso)).replace(".", "");
}

/** Bloco de data (dia grande + mês), como na agenda da tela inicial. */
export function DateBlock({ iso, className }: { iso: string; className?: string }) {
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit" }).format(new Date(iso));
  const month = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, month: "short" }).format(new Date(iso)).replace(".", "");
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border border-[#dce9eb] bg-[#f6fafb] leading-none",
        className
      )}
    >
      <span className="text-lg font-semibold tabular-nums text-[#0d2a38]">{day}</span>
      <span className="mt-0.5 text-xs font-medium text-[#5a717b]">{month}</span>
    </span>
  );
}

const STATUS: Record<OneOnOneDisplayStatus, { label: string; className: string; icon: typeof CalendarClock }> = {
  agendada: { label: "Agendada", className: "bg-[#e6f0f5] text-[#285f7a] ring-[#347796]/15", icon: CalendarClock },
  atrasada: { label: "Não finalizada", className: "bg-amber-50 text-amber-800 ring-amber-600/20", icon: AlarmClock },
  realizada: { label: "Realizada", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground ring-border", icon: CircleSlash },
};

export function MeetingStatusBadge({ status, className }: { status: OneOnOneDisplayStatus; className?: string }) {
  const item = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", item.className, className)}>
      <item.icon className="size-3" aria-hidden />
      {item.label}
    </span>
  );
}

export function CadenceBadge({
  cadence,
  daysSinceLast,
  overdueDays,
  className,
}: {
  cadence: OneOnOneCadence;
  daysSinceLast: number | null;
  overdueDays: number;
  className?: string;
}) {
  const label =
    cadence === "sem_reuniao"
      ? "Nenhuma 1:1 ainda"
      : daysSinceLast === null
        ? "Primeira 1:1 marcada"
        : daysSinceLast === 0
          ? "1:1 hoje"
          : `${daysSinceLast} ${daysSinceLast === 1 ? "dia" : "dias"} desde a última`;
  const style =
    cadence === "em_dia"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-600/15"
      : cadence === "atrasada"
        ? "bg-red-50 text-red-800 ring-red-600/20"
        : "bg-[#f1f5f6] text-[#3b5560] ring-[#dce9eb]";
  return (
    <Hint label={`Em dia = 1:1 realizada nos últimos ${overdueDays} dias`}>
      <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", style, className)}>
        {cadence === "atrasada" && <AlarmClock className="size-3" aria-hidden />}
        {label}
      </span>
    </Hint>
  );
}

export function SourceTag({ source }: { source: string }) {
  if (source === "pdi")
    return <span className="rounded-full bg-[#ecebf3] px-1.5 py-0.5 text-xs font-medium text-[#48466e]">PDI</span>;
  if (source === "pendencia")
    return <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">pendência</span>;
  if (source === "sugerido")
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#e3f7f7] px-1.5 py-0.5 text-xs font-medium text-[#1f7f82]">
        <Sparkles className="size-2.5" aria-hidden />
        sugerido
      </span>
    );
  return null;
}

/** Ícone de cada categoria de 1:1, pelo nome (as categorias são cadastradas pelo RH). */
export function categoryIcon(name: string | null | undefined): LucideIcon {
  const key = (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!key) return MessagesSquare;
  if (key.includes("pdi") || key.includes("plano de desenvolvimento")) return Sprout;
  if (key.includes("avaliacao") || key.includes("devolutiva")) return ClipboardCheck;
  if (key.includes("prioridade") || key.includes("entrega")) return ListChecks;
  if (key.includes("meta")) return Target;
  if (key.includes("desempenho")) return BarChart3;
  if (key.includes("cultura") || key.includes("valores")) return HeartHandshake;
  if (key.includes("desenvolvimento") || key.includes("expectativa")) return TrendingUp;
  return MessagesSquare;
}

/** Ícone da categoria como componente (o ícone muda com o nome). */
export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  return createElement(categoryIcon(name), { className, "aria-hidden": true });
}
