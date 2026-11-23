"use client";

import {
  AirVent,
  AlertTriangle,
  Armchair,
  ArrowUpDown,
  BatteryCharging,
  Building,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  Cctv,
  CheckCircle2,
  Droplets,
  FireExtinguisher,
  Network,
  PauseCircle,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { formatShortDate } from "@/lib/facilities/alerts";
import { PERIODICITY_INFO, SITUATION_LABEL, type MaintenanceSituation } from "@/lib/facilities/maintenance";
import { ASSET_CATEGORY_LABEL, type AssetCategory, type MaintenancePlan } from "@/lib/facilities/types";
import { cn } from "@/lib/utils";

export const ASSET_ICON: Record<AssetCategory, LucideIcon> = {
  ar_condicionado: AirVent,
  eletrica: Zap,
  hidraulica: Droplets,
  elevador: ArrowUpDown,
  gerador: BatteryCharging,
  ti_rede: Network,
  seguranca_incendio: FireExtinguisher,
  alarme_cftv: Cctv,
  mobiliario: Armchair,
  predial: Building,
  outros: Wrench,
};

const ASSET_TONE: Record<AssetCategory, string> = {
  ar_condicionado: "bg-[#e8f8f8] text-[#1f6f72] ring-[#47cdd0]/30",
  eletrica: "bg-amber-50 text-amber-800 ring-amber-200",
  hidraulica: "bg-[#e9f2f8] text-[#285f7a] ring-[#3e84a8]/25",
  elevador: "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/20",
  gerador: "bg-amber-50 text-amber-800 ring-amber-200",
  ti_rede: "bg-[#e9f2f8] text-[#285f7a] ring-[#3e84a8]/25",
  seguranca_incendio: "bg-red-50 text-red-800 ring-red-200",
  alarme_cftv: "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/20",
  mobiliario: "bg-slate-50 text-slate-700 ring-slate-200",
  predial: "bg-slate-50 text-slate-700 ring-slate-200",
  outros: "bg-slate-50 text-slate-700 ring-slate-200",
};

export function AssetTile({ category, size = "md", className }: { category: AssetCategory; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = ASSET_ICON[category] ?? Wrench;
  return (
    <span
      title={ASSET_CATEGORY_LABEL[category]}
      className={cn(
        "grid shrink-0 place-items-center rounded-md ring-1 ring-inset",
        size === "lg" ? "size-14" : size === "md" ? "size-10" : "size-8",
        ASSET_TONE[category] ?? ASSET_TONE.outros,
        className
      )}
    >
      <Icon className={size === "lg" ? "size-6" : size === "md" ? "size-5" : "size-4"} aria-hidden />
    </span>
  );
}

export const SITUATION_STYLE: Record<MaintenanceSituation, { icon: LucideIcon; className: string; color: string }> = {
  atrasada: { icon: AlertTriangle, className: "bg-red-50 text-red-800 ring-red-200", color: "#b91c1c" },
  proxima: { icon: CalendarClock, className: "bg-amber-50 text-amber-800 ring-amber-200", color: "#b45309" },
  em_dia: { icon: CheckCircle2, className: "bg-[#e8f8f8] text-[#1f6f72] ring-[#47cdd0]/30", color: "#1f6f72" },
  sem_data: { icon: CalendarX2, className: "bg-slate-50 text-slate-600 ring-slate-200", color: "#64748b" },
  pausada: { icon: PauseCircle, className: "bg-slate-50 text-slate-600 ring-slate-200", color: "#64748b" },
  concluida: { icon: CalendarCheck2, className: "bg-[#eef3f5] text-[#285f7a] ring-[#c9dde1]", color: "#285f7a" },
};

/** "Atrasada há 3 dias", "Vence em 5 dias", "Em dia". */
export function situationText(situation: MaintenanceSituation, days: number | null): string {
  if (situation === "atrasada" && days !== null) return days === -1 ? "Atrasada há 1 dia" : `Atrasada há ${-days} dias`;
  if (situation === "proxima" && days !== null) return days === 0 ? "Vence hoje" : days === 1 ? "Vence amanhã" : `Vence em ${days} dias`;
  return SITUATION_LABEL[situation];
}

export function SituationBadge({
  situation,
  days,
  className,
}: {
  situation: MaintenanceSituation;
  days: number | null;
  className?: string;
}) {
  const style = SITUATION_STYLE[situation];
  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", style.className, className)}>
      <style.icon className="size-3 shrink-0" aria-hidden />
      {situationText(situation, days)}
    </span>
  );
}

export function periodicityText(plan: Pick<MaintenancePlan, "periodicity" | "custom_interval_days">): string {
  if (plan.periodicity === "personalizada" && plan.custom_interval_days) return `A cada ${plan.custom_interval_days} dias`;
  return PERIODICITY_INFO[plan.periodicity].label;
}

export function dateOrDash(iso: string | null): string {
  return iso ? formatShortDate(iso) : "—";
}
