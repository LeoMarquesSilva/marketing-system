"use client";

import { Badge } from "@/components/ui/badge";
import type { PracticeType } from "@/lib/clima-types";
import { cn } from "@/lib/utils";

const PRACTICE_CONFIG: Record<
  PracticeType,
  { label: string; className: string }
> = {
  acelerar: {
    label: "Acelerar",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  evitar: {
    label: "Evitar",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  comecar: {
    label: "Começar",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
};

interface PracticeBadgeProps {
  type: PracticeType;
  className?: string;
}

export function PracticeBadge({ type, className }: PracticeBadgeProps) {
  const config = PRACTICE_CONFIG[type];
  if (!config) return null;
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
