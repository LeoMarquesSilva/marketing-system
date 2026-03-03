"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

interface ChartByStatusProps {
  data: { name: string; value: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  Pendente: "hsl(var(--muted-foreground))",
  "Em andamento": "hsl(45 93% 47%)",
  Concluído: "hsl(142 76% 36%)",
};

export function ChartByStatus({ data }: ChartByStatusProps) {
  const chartData = data.map((item) => ({
    ...item,
    color: STATUS_COLORS[item.name] || "hsl(var(--primary))",
  }));

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <span className="text-base font-semibold text-foreground">
          Status das Tarefas Atuais
        </span>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] min-h-[220px] min-w-0 w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={220}
            initialDimension={{ width: 400, height: 320 }}
          >
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={(props) => <ChartTooltip {...props} />} />
              <Legend
                wrapperStyle={{ paddingTop: "16px" }}
                iconSize={16}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
