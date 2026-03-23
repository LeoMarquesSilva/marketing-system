"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Indicator } from "@/lib/clima-types";
import { StatementChart } from "./statement-chart";
import { PracticeBadge } from "./practice-badge";
import { ScoreLegend } from "./score-legend";

interface ClimaIndicadoresTabProps {
  indicadores: Indicator[];
}

export function ClimaIndicadoresTab({ indicadores }: ClimaIndicadoresTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["proposito"]));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Indicadores e afirmações</h2>
        <p className="text-sm text-muted-foreground">
          Clique para expandir e ver cada afirmação com percentuais de resposta
        </p>
        <div className="mt-3">
          <ScoreLegend />
        </div>
      </div>

      <div className="space-y-6">
        {indicadores.map((ind) => {
          const isExpanded = expanded.has(ind.id);
          return (
            <Card key={ind.id} className="rounded-xl overflow-hidden">
              <CardHeader
                className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => toggle(ind.id)}
              >
                <div className="flex items-start gap-3">
                  <button type="button" className="mt-0.5 shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{ind.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ind.question}
                    </p>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0 space-y-6">
                  {ind.statements.map((stmt) => (
                    <div
                      key={stmt.id}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium flex-1 min-w-0">
                          {stmt.text}
                        </p>
                        {stmt.practiceType && (
                          <PracticeBadge type={stmt.practiceType} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <StatementChart scores={stmt.scores} />
                      </div>
                      {stmt.actions && stmt.actions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Ações propostas:
                          </p>
                          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                            {stmt.actions.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                  {ind.actions.length > 0 && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Ações gerais do indicador:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ind.actions.map((a, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-background px-2 py-1 text-xs"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
