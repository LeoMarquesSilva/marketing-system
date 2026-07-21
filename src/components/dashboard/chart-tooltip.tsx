"use client";

import { FileText } from "lucide-react";
import { AreaIcon } from "@/lib/area-icons";
import { TypeIcon } from "@/lib/type-icons";

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

  const icon =
    useAreaIcons && typeof displayLabel === "string" ? (
      <AreaIcon area={displayLabel} className="h-5 w-5" />
    ) : useTypeIcons && typeof displayLabel === "string" ? (
      <TypeIcon type={displayLabel} className="h-5 w-5" />
    ) : (
      <FileText className="h-5 w-5" />
    );

  return (
    <div
      className="rounded-md border border-[#47cdd0]/30 bg-white px-4 py-3 dark:bg-[#04202f]"
      style={{
        boxShadow: "0 18px 48px -22px rgba(3,32,47,0.5)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
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
