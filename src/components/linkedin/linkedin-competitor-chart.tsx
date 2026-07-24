"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LinkedinCompetitorSnapshot } from "@/lib/linkedin-types";

export type LinkedinCompetitorMetric =
  | "new_followers"
  | "publications"
  | "reactions"
  | "comments"
  | "reactions_per_post";

const METRIC_LABELS: Record<LinkedinCompetitorMetric, string> = {
  new_followers: "Novos seguidores",
  publications: "Publicações",
  reactions: "Reações",
  comments: "Comentários",
  reactions_per_post: "Reações por publicação",
};

function isOwnPage(pageName: string): boolean {
  const normalized = pageName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.includes("bismarchi") && normalized.includes("pires");
}

function shortName(pageName: string): string {
  return pageName
    .replace(/Sociedade de Advogados/gi, "")
    .replace(/Advogados/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function LinkedinCompetitorChart({
  rows,
  metric,
}: {
  rows: LinkedinCompetitorSnapshot[];
  metric: LinkedinCompetitorMetric;
}) {
  const data = rows
    .map((row) => ({
      page: shortName(row.page_name),
      fullPage: row.page_name,
      value: metric === "reactions_per_post"
        ? (row.publications > 0 ? row.reactions / row.publications : 0)
        : row[metric],
      own: isOwnPage(row.page_name),
    }))
    .sort((left, right) => right.value - left.value);

  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Importe o relatório de concorrência para ver o benchmark.</p>;
  }

  return (
    <div className="h-[430px] min-h-[430px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={430}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 18, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="rgba(15,23,42,0.07)" />
          <XAxis
            type="number"
            tickFormatter={(value) => Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="page"
            width={132}
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(10,102,194,0.04)" }}
            formatter={(value) => [Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 }), METRIC_LABELS[metric]]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullPage ?? ""}
            contentStyle={{ borderRadius: 12, borderColor: "rgba(148,163,184,0.4)", fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
            {data.map((item) => (
              <Cell key={item.fullPage} fill={item.own ? "#47cdd0" : "#0A66C2"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
