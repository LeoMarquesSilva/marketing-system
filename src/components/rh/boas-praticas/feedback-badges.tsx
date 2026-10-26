import {
  CheckCheck,
  CircleDashed,
  Eye,
  EyeOff,
  ShieldCheck,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AREA_BAND_LABEL,
  FLOW_STATUS_LABEL,
  type AreaBand,
  type FeedbackFlowStatus,
} from "@/lib/rh/boas-praticas/types";

export const FLOW_STATUS_STYLE: Record<FeedbackFlowStatus, { className: string; icon: LucideIcon }> = {
  respondido: { className: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: CheckCheck },
  visualizado: { className: "bg-sky-50 text-sky-800 ring-sky-200", icon: Eye },
  nao_visualizado: { className: "bg-amber-50 text-amber-800 ring-amber-200", icon: EyeOff },
  sem_dado: { className: "bg-slate-50 text-slate-600 ring-slate-200", icon: CircleDashed },
};

export const BAND_STYLE: Record<AreaBand, { className: string; icon: LucideIcon; panel: string }> = {
  acionamento: {
    className: "bg-red-50 text-red-700 ring-red-200",
    icon: Siren,
    panel: "bg-red-50 text-red-900 ring-red-200",
  },
  atencao: {
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    icon: TriangleAlert,
    panel: "bg-amber-50 text-amber-950 ring-amber-200",
  },
  monitoramento: {
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: ShieldCheck,
    panel: "bg-emerald-50 text-emerald-950 ring-emerald-200",
  },
};

const BADGE_BASE =
  "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function FlowStatusBadge({ status, className }: { status: FeedbackFlowStatus; className?: string }) {
  const { className: tone, icon: Icon } = FLOW_STATUS_STYLE[status];
  return (
    <span className={cn(BADGE_BASE, tone, className)}>
      <Icon className="size-3" aria-hidden />
      {FLOW_STATUS_LABEL[status]}
    </span>
  );
}

export function BandBadge({ band }: { band: AreaBand | null }) {
  if (!band) return <span className="text-xs text-muted-foreground">Sem feedback</span>;
  const { className, icon: Icon } = BAND_STYLE[band];
  return (
    <span className={cn(BADGE_BASE, className)}>
      <Icon className="size-3" aria-hidden />
      {AREA_BAND_LABEL[band]}
    </span>
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "20 out · ter" */
export function formatDayLabel(iso: string): { day: string; month: string; weekday: string } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { day: String(day).padStart(2, "0"), month: MONTH_ABBR[month - 1], weekday: WEEKDAY[weekday] };
}

/** Hora (HH:mm) de um instante, no fuso do escritório. */
export function formatTimeSP(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

/** Data (AAAA-MM-DD) de um instante, no fuso do escritório. */
export function isoDateSP(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Zero vira travessão, como na planilha. */
export function dashIfZero(value: number): string {
  return value === 0 ? "–" : String(value);
}
