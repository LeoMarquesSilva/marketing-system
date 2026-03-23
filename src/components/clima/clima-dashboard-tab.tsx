"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IndicatorCard } from "./indicator-card";
import type { Indicator, PracticeType, QuantitativeIndicator } from "@/lib/clima-types";
import { BarChart3, Filter, Star } from "lucide-react";
import { StatementChart } from "./statement-chart";
import { PracticeBadge } from "./practice-badge";

function AverageScoreDisplay({
  score,
  max,
  responseCount,
}: {
  score: number;
  max: number;
  responseCount?: number;
}) {
  const filledStars = Math.round((score / max) * 10);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${
                i < filledStars
                  ? "fill-amber-400 text-amber-500"
                  : "fill-muted text-muted-foreground/40"
              }`}
            />
          ))}
        </div>
        <span className="text-lg font-semibold tabular-nums">
          {score.toFixed(2)}/{max}
        </span>
      </div>
      {responseCount != null && (
        <p className="text-xs text-muted-foreground">{responseCount} respostas</p>
      )}
    </div>
  );
}

interface ClimaDashboardTabProps {
  indicadores: Indicator[];
  indicadoresQuantitativos: QuantitativeIndicator[];
}

export function ClimaDashboardTab({
  indicadores,
  indicadoresQuantitativos,
}: ClimaDashboardTabProps) {
  const [filterPractice, setFilterPractice] = useState<PracticeType | "todos">("todos");

  const criticas = useMemo(() => {
    const items: { indicator: Indicator; statementText: string; disagreePercent: number }[] = [];
    indicadores.forEach((ind) => {
      ind.statements.forEach((s) => {
        const total = s.scores.reduce((a, b) => a + b, 0);
        if (total <= 0) return;
        // Discordo totalmente + Discordo = índices 0 e 1
        const disagree = (s.scores[0] ?? 0) + (s.scores[1] ?? 0);
        const pct = (disagree / total) * 100;
        if (pct >= 30) {
          items.push({
            indicator: ind,
            statementText: s.text,
            disagreePercent: Math.round(pct),
          });
        }
      });
    });
    return items.sort((a, b) => b.disagreePercent - a.disagreePercent).slice(0, 8);
  }, [indicadores]);

  const filteredIndicadores =
    filterPractice === "todos"
      ? indicadores
      : indicadores.filter((ind) =>
          ind.statements.some((s) => s.practiceType === filterPractice)
        );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Visão geral</h2>
        <p className="text-sm text-muted-foreground">
          Scores dos indicadores e afirmações mais críticas
        </p>
      </div>

      {/* Filtro por categoria */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        {(["todos", "acelerar", "evitar", "comecar"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterPractice(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filterPractice === key
                ? "bg-[#101f2e] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {key === "todos" ? "Todos" : key === "acelerar" ? "Acelerar" : key === "evitar" ? "Evitar" : "Começar"}
          </button>
        ))}
      </div>

      {/* Cards dos 6 indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredIndicadores.map((ind) => (
          <IndicatorCard key={ind.id} indicator={ind} />
        ))}
      </div>

      {/* Indicadores quantitativos */}
      <Card className="overflow-hidden rounded-xl">
        <CardHeader>
          <span className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-4 w-4" />
            Indicadores quantitativos
          </span>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {indicadoresQuantitativos.map((q) => (
              <div key={q.id} className="min-w-0 overflow-hidden rounded-lg border p-3">
                <p className="truncate text-sm font-medium">{q.name}</p>
                {q.question && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{q.question}</p>
                )}
                <div className="mt-2 min-h-[100px] overflow-hidden">
                  {q.averageScore != null && q.scaleMax != null ? (
                    <AverageScoreDisplay
                      score={q.averageScore}
                      max={q.scaleMax}
                      responseCount={q.responseCount}
                    />
                  ) : q.scores && q.scores.length > 0 ? (
                    <StatementChart
                      scores={q.scores}
                      labels={q.labels ?? q.scores.map((_, i) => `Opção ${i + 1}`)}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Afirmações mais críticas */}
      <Card className="rounded-xl">
        <CardHeader>
          <span className="text-base font-semibold text-foreground">
            Afirmações com maior insatisfação (% discordo)
          </span>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {criticas.map((c, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{c.statementText}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.indicator.name}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
                  {c.disagreePercent}% discordo
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
