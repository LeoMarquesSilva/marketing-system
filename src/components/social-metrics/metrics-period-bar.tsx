"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  METRICS_COMPARE_OPTIONS,
  METRICS_PRESETS,
  parseMetricsPeriod,
  resolveMetricsPeriod,
  serializeMetricsPeriod,
  type MetricsPeriodState,
  type ResolvedMetricsPeriod,
} from "@/lib/social-metrics/period";

const STORAGE_KEY = "orqestrai:metricas:periodo";

/**
 * Período das telas de Métricas, guardado na URL (?periodo=28d&comparar=anterior)
 * e lembrado no navegador ao trocar de aba (Resumo → Instagram → LinkedIn → Site).
 */
export function useMetricsPeriod(): {
  state: MetricsPeriodState;
  period: ResolvedMetricsPeriod;
  setState: (next: MetricsPeriodState) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasUrlPeriod = searchParams.has("periodo");
  const state = React.useMemo(() => parseMetricsPeriod(new URLSearchParams(searchParams.toString())), [searchParams]);

  // Sem período na URL: usa o último escolhido (vindo de outra aba de Métricas).
  React.useEffect(() => {
    if (hasUrlPeriod) return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(serializeMetricsPeriod(parseMetricsPeriod(new URLSearchParams(saved))))) {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      // navegador sem localStorage: segue com o padrão
    }
  }, [hasUrlPeriod, pathname, router, searchParams]);

  const setState = React.useCallback(
    (next: MetricsPeriodState) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of ["periodo", "comparar", "de", "ate"]) params.delete(key);
      const serialized = serializeMetricsPeriod(next);
      for (const [key, value] of Object.entries(serialized)) params.set(key, value);
      try {
        window.localStorage.setItem(STORAGE_KEY, new URLSearchParams(serialized).toString());
      } catch {
        // ignora
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const period = React.useMemo(() => resolveMetricsPeriod(state), [state]);
  return { state, period, setState };
}

function CustomRange({ state, onApply }: { state: MetricsPeriodState; onApply: (from: string, to: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const resolved = resolveMetricsPeriod(state);
  const [from, setFrom] = React.useState(resolved.from);
  const [to, setTo] = React.useState(resolved.to);
  const selected = state.preset === "personalizado";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setFrom(resolved.from);
          setTo(resolved.to);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-pressed={selected}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-[5px] px-3 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
            selected ? "bg-[#347796] font-medium text-white" : "text-[#4a6470] hover:bg-[#47cdd0]/10 hover:text-[#10232d]"
          )}
        >
          <CalendarRange className="size-4" aria-hidden />
          {selected ? resolved.label : "Personalizado"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3 p-4">
        <p className="text-sm font-semibold text-[#10232d]">Escolha as datas</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            De
            <DatePickerField value={from} onChange={setFrom} startYear={2025} endYear={new Date().getFullYear()} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Até
            <DatePickerField value={to} onChange={setTo} startYear={2025} endYear={new Date().getFullYear()} />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!from || !to}
            onClick={() => {
              onApply(from, to);
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MetricsPeriodBar({
  state,
  period,
  onChange,
  right,
}: {
  state: MetricsPeriodState;
  period: ResolvedMetricsPeriod;
  onChange: (next: MetricsPeriodState) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white p-2 shadow-[0_1px_2px_rgba(4,32,47,0.04)] xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Período" className="inline-flex flex-wrap rounded-md bg-[#f4f8f9] p-0.5">
          {METRICS_PRESETS.filter((preset) => preset.value !== "personalizado").map((preset) => {
            const selected = state.preset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...state, preset: preset.value, from: undefined, to: undefined })}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-[5px] px-3 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                  selected ? "bg-[#347796] font-medium text-white" : "text-[#4a6470] hover:bg-[#47cdd0]/10 hover:text-[#10232d]"
                )}
              >
                {preset.label}
              </button>
            );
          })}
          <CustomRange state={state} onApply={(from, to) => onChange({ ...state, preset: "personalizado", from, to })} />
        </div>
        <div role="radiogroup" aria-label="Comparar com" className="inline-flex rounded-md border border-[#dce9eb] p-0.5">
          {METRICS_COMPARE_OPTIONS.map((option) => {
            const selected = state.compare === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...state, compare: option.value })}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-[4px] px-2.5 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                  selected ? "bg-[#e8f3f6] font-semibold text-[#1f5873]" : "text-[#4a6470] hover:bg-[#f4f8f9]"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <span className="px-1 text-xs text-muted-foreground">
          {period.label.includes("·") ? period.label.split("·")[1].trim() : period.label} · comparando com {period.compareLabel}
        </span>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2 xl:justify-end">{right}</div>}
    </div>
  );
}
