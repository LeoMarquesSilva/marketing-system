"use client";

import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MONTH_LABELS,
  type CustosPeriodFilter,
  formatPeriodFilterLabel,
} from "@/lib/custos-period-filter";

interface CustosPeriodFilterBarProps {
  filter: CustosPeriodFilter;
  years: number[];
  onChange: (filter: CustosPeriodFilter) => void;
}

export function CustosPeriodFilterBar({
  filter,
  years,
  onChange,
}: CustosPeriodFilterBarProps) {
  const monthValue = filter.month == null ? "all" : String(filter.month);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
        <CalendarDays className="h-4 w-4" />
        Período
      </div>

      <Select
        value={String(filter.year)}
        onValueChange={(v) => onChange({ ...filter, year: Number(v) })}
      >
        <SelectTrigger className="w-[110px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-background text-sm">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={monthValue}
        onValueChange={(v) =>
          onChange({
            ...filter,
            month: v === "all" ? null : Number(v),
          })
        }
      >
        <SelectTrigger className="w-[160px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-background text-sm">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todo o ano</SelectItem>
          {MONTH_LABELS.map((label, i) => (
            <SelectItem key={label} value={String(i + 1)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground ml-auto">
        {formatPeriodFilterLabel(filter)}
      </span>
    </div>
  );
}
