"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, Check } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import type { DateRange as RdpDateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  PERIOD_PRESETS,
  MONTH_SHORT,
  formatPeriodFilterLabel,
  type PeriodFilter,
} from "@/lib/instagram-period";
import { cn } from "@/lib/utils";

interface PeriodPickerProps {
  value: PeriodFilter;
  onChange: (value: PeriodFilter) => void;
  availableYears: number[];
  className?: string;
}

export function InstagramPeriodPicker({
  value,
  onChange,
  availableYears,
  className,
}: PeriodPickerProps) {
  const [open, setOpen] = React.useState(false);
  const currentYear = new Date().getFullYear();
  const [monthYear, setMonthYear] = React.useState<number>(
    value.kind === "month" ? value.year : availableYears[0] ?? currentYear
  );
  const [range, setRange] = React.useState<RdpDateRange | undefined>(
    value.kind === "range"
      ? {
          from: new Date(`${value.from}T00:00:00`),
          to: new Date(`${value.to}T00:00:00`),
        }
      : undefined
  );

  const apply = (next: PeriodFilter, close = true) => {
    onChange(next);
    if (close) setOpen(false);
  };

  const handleRangeSelect = (r: RdpDateRange | undefined) => {
    setRange(r);
    if (r?.from && r?.to) {
      apply({
        kind: "range",
        from: format(r.from, "yyyy-MM-dd"),
        to: format(r.to, "yyyy-MM-dd"),
      });
    }
  };

  const isPreset = (preset: string) =>
    value.kind === "preset" && value.preset === preset;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 rounded-xl justify-between gap-2 min-w-[190px]", className)}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{formatPeriodFilterLabel(value)}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-[100] w-[min(92vw,640px)] rounded-2xl border bg-popover p-0 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="grid gap-0 sm:grid-cols-[230px_1fr]">
            {/* Coluna esquerda: atalhos + mês + ano */}
            <div className="border-b sm:border-b-0 sm:border-r border-border/50 p-3 space-y-4 max-h-[420px] overflow-y-auto">
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Atalhos
                </p>
                <button
                  type="button"
                  onClick={() => apply({ kind: "all" })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted/60",
                    value.kind === "all" && "bg-muted font-medium"
                  )}
                >
                  Todo o período
                  {value.kind === "all" && <Check className="h-3.5 w-3.5" />}
                </button>
                {PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => apply({ kind: "preset", preset: preset.value })}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted/60",
                      isPreset(preset.value) && "bg-muted font-medium"
                    )}
                  >
                    {preset.label}
                    {isPreset(preset.value) && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Por ano
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => apply({ kind: "year", year })}
                      className={cn(
                        "rounded-lg border border-border/50 px-2.5 py-1 text-xs tabular-nums hover:bg-muted/60",
                        value.kind === "year" && value.year === year &&
                          "border-[#101f2e] bg-[#101f2e] text-white"
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna direita: mês específico + intervalo */}
            <div className="p-3 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Mês específico
                  </p>
                  <select
                    value={monthYear}
                    onChange={(e) => setMonthYear(Number(e.target.value))}
                    className="h-7 rounded-md border border-border/60 bg-background px-2 text-xs tabular-nums"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MONTH_SHORT.map((label, idx) => {
                    const active =
                      value.kind === "month" &&
                      value.year === monthYear &&
                      value.month === idx;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => apply({ kind: "month", year: monthYear, month: idx })}
                        className={cn(
                          "rounded-lg border border-border/50 py-1.5 text-xs capitalize hover:bg-muted/60",
                          active && "border-[#101f2e] bg-[#101f2e] text-white"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Intervalo personalizado
                </p>
                <div className="rounded-xl border border-border/40 flex justify-center">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={handleRangeSelect}
                    locale={ptBR}
                    numberOfMonths={1}
                    defaultMonth={range?.from}
                  />
                </div>
              </div>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
