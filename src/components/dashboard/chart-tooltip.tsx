"use client";

import { FileText } from "lucide-react";
import { getAreaIcon } from "@/lib/area-icons";
import { getTypeIcon } from "@/lib/type-icons";

interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly unknown[] | unknown[];
  label?: string | number;
  valueSuffix?: string;
  useAreaIcons?: boolean;
  useTypeIcons?: boolean;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix = "solicitações",
  useAreaIcons = false,
  useTypeIcons = false,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const item = payload[0] as {
    value?: number;
    payload?: { area?: string; name?: string };
    name?: string;
  };
  const displayLabel = label ?? item.payload?.area ?? item.payload?.name ?? item.name ?? "";
  const value = typeof item.value === "number" ? item.value : Number(item.value) || 0;

  let Icon = FileText;
  if (useAreaIcons && typeof displayLabel === "string") Icon = getAreaIcon(displayLabel);
  else if (useTypeIcons && typeof displayLabel === "string") Icon = getTypeIcon(displayLabel);

  return (
    <div
      className="rounded-lg border-2 border-border bg-white px-4 py-3 dark:bg-slate-900"
      style={{
        boxShadow: "0 10px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{displayLabel}</p>
          <p className="text-sm text-muted-foreground">
            {value} {valueSuffix}
          </p>
        </div>
      </div>
    </div>
  );
}
