"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Indicator } from "@/lib/clima-types";
import { cn } from "@/lib/utils";

/**
 * Calcula % positivo (Concordo + Concordo totalmente) para score geral.
 * Legenda: [0]DT [1]D [2]N [3]C [4]CT → positivo = índices 3 e 4
 */
export function calcPositiveScore(scores: number[]): number {
  const total = scores.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const positive = (scores[3] ?? 0) + (scores[4] ?? 0);
  return (positive / total) * 100;
}

/** Retorna criticidade: critico | atencao | bom */
export function getCriticity(positivePercent: number): "critico" | "atencao" | "bom" {
  if (positivePercent < 50) return "critico";
  if (positivePercent < 70) return "atencao";
  return "bom";
}

const CRITICITY_STYLES = {
  critico: "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
  atencao: "border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
  bom: "border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
};

interface IndicatorCardProps {
  indicator: Indicator;
  onClick?: () => void;
  compact?: boolean;
}

export function IndicatorCard({ indicator, onClick, compact }: IndicatorCardProps) {
  const allScores = indicator.statements.flatMap((s) => s.scores);
  const avgPositive =
    indicator.statements.length > 0
      ? indicator.statements.reduce((acc, s) => acc + calcPositiveScore(s.scores), 0) /
        indicator.statements.length
      : 0;
  const criticity = getCriticity(avgPositive);

  return (
    <Card
      className={cn(
        "rounded-xl transition-shadow hover:shadow-md",
        CRITICITY_STYLES[criticity],
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground">{indicator.name}</h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              criticity === "critico" && "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
              criticity === "atencao" && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
              criticity === "bom" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
            )}
          >
            {Math.round(avgPositive)}% positivo
          </span>
        </div>
        {!compact && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {indicator.question}
          </p>
        )}
      </CardHeader>
      {!compact && (
        <CardContent className="pt-0">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                criticity === "critico" && "bg-red-500",
                criticity === "atencao" && "bg-amber-500",
                criticity === "bom" && "bg-emerald-500"
              )}
              style={{ width: `${avgPositive}%` }}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
