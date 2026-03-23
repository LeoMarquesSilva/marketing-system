"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { SCORE_LABELS } from "@/lib/clima-types";

/**
 * Cores da legenda Miro (conforme slide):
 * Laranja escuro/marrom = Discordo totalmente | Cinza claro = Discordo
 * Cinza médio = Nem discordo nem concordo | Azul médio = Concordo | Azul escuro = Concordo totalmente
 */
const COLORS = [
  "hsl(25 76% 31%)",  // laranja escuro/marrom - Discordo totalmente
  "hsl(0 0% 72%)",    // cinza claro - Discordo
  "hsl(0 0% 58%)",    // cinza médio - Nem discordo, nem concordo
  "hsl(210 65% 56%)", // azul médio - Concordo
  "hsl(215 55% 25%)", // azul escuro - Concordo totalmente
];

interface StatementChartProps {
  scores: number[];
  labels?: readonly string[];
}

/** Normaliza scores para 5 categorias (pad com 0 se necessário) */
function normalizeScores(scores: number[]): number[] {
  const out = [0, 0, 0, 0, 0];
  scores.forEach((v, i) => { out[Math.min(i, 4)] = v; });
  return out;
}

export function StatementChart({ scores, labels = SCORE_LABELS }: StatementChartProps) {
  const normalized = normalizeScores(scores);
  const data = normalized.map((value, i) => ({
    name: labels[i] ?? `Opção ${i + 1}`,
    value: Math.round(value * 10) / 10,
    fill: COLORS[i],
  }));

  return (
    <div className="h-[120px] min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={68}
            tick={{ fontSize: 9 }}
            tickLine={false}
            tickFormatter={(v) =>
              typeof v === "string" && v.length > 11 ? `${v.slice(0, 10)}…` : String(v ?? "")
            }
          />
          <Tooltip
            formatter={(value: number | undefined) => (value != null ? `${value}%` : "")}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v}%` : "")}
              style={{ fontSize: 11 }}
            />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
