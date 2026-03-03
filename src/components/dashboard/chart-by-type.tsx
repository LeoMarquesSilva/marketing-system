"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getTypeIcon } from "@/lib/type-icons";
import { ChartTooltip } from "./chart-tooltip";

interface ChartByTypeProps {
  data: { name: string; value: number }[];
}

const ROW_HEIGHT = 60;
const MIN_HEIGHT = 280;
const LABELS_WIDTH = 260;

export function ChartByType({ data }: ChartByTypeProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxValue = useMemo(
    () => (data.length ? Math.max(...data.map((d) => d.value), 1) : 1),
    [data]
  );
  const chartHeight = useMemo(
    () => Math.max(MIN_HEIGHT, data.length * ROW_HEIGHT + 24),
    [data.length]
  );

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <span className="text-base font-semibold text-foreground">
          Solicitações por Tipo
        </span>
      </CardHeader>
      <CardContent>
        <div
          className="flex w-full min-w-0"
          style={{ minHeight: chartHeight }}
        >
          {/* Coluna de labels - fixa à esquerda */}
          <div
            className="flex shrink-0 flex-col border-r border-border pr-4"
            style={{ width: LABELS_WIDTH }}
          >
            {data.map((item) => {
              const Icon = getTypeIcon(item.name);
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-2"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className="min-w-0 flex-1 break-words text-sm font-medium text-foreground"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Coluna do gráfico - barras */}
          <div className="relative min-w-0 flex-1 pl-6">
            <div className="flex flex-col" style={{ minHeight: data.length * ROW_HEIGHT }}>
              {data.map((item, i) => {
                const pct = (item.value / maxValue) * 100;
                const isHovered = hoveredIndex === i;
                return (
                  <div
                    key={item.name}
                    className="group relative flex items-center"
                    style={{ height: ROW_HEIGHT }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className="relative flex h-6 w-full items-center">
                      <div
                        className="relative flex h-full items-center rounded-r-md bg-primary transition-all duration-200"
                        style={{
                          width: `max(${Math.max(pct, 2)}%, 28px)`,
                          opacity: isHovered ? 1 : 0.85,
                        }}
                      >
                        <span className="absolute left-2 text-xs font-semibold text-primary-foreground">
                          {item.value}
                        </span>
                      </div>
                    </div>
                    {isHovered && (
                      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-full">
                        <ChartTooltip
                          active={true}
                          payload={[{ value: item.value, payload: { name: item.name } }]}
                          label={item.name}
                          useTypeIcons
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs text-muted-foreground">
              <span>0</span>
              <span>{maxValue}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
