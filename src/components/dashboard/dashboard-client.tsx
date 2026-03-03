"use client";

import { useMemo } from "react";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { ChartByArea } from "@/components/dashboard/chart-by-area";
import { ChartByStatus } from "@/components/dashboard/chart-by-status";
import { ChartByType } from "@/components/dashboard/chart-by-type";
import { ChartTimesheet } from "@/components/dashboard/chart-timesheet";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { computeDashboardMetrics } from "@/lib/marketing-requests";
import { useAuth } from "@/contexts/auth-context";

interface DashboardClientProps {
  requests: MarketingRequest[];
  assigneeAvatarUrl?: string | null;
}

export function DashboardClient({ requests }: DashboardClientProps) {
  const { profile } = useAuth();

  const requestsFiltered = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase();
    const isDesigner = r === "designer" || profile?.department === "Marketing";
    if (isDesigner && profile?.id) {
      return requests.filter((req) => req.assignee_id === profile.id);
    }
    return requests;
  }, [requests, profile?.id, profile?.role, profile?.department]);

  const normalizedRequests = useMemo(() => {
    return requestsFiltered;
  }, [requestsFiltered]);

  const {
    total,
    totalThisMonth,
    avgDeliveryDays,
    completedCount,
    overdueCount,
    unassignedCount,
    dataByArea,
    dataByStatus,
    dataByType,
  } = computeDashboardMetrics(normalizedRequests);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">Visão geral das solicitações e eficiência da equipe</p>
      </div>

      <KpiCards
        total={total}
        totalThisMonth={totalThisMonth}
        avgDeliveryDays={avgDeliveryDays}
        completedCount={completedCount}
        overdueCount={overdueCount}
        unassignedCount={unassignedCount}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <ChartByArea data={dataByArea} />
        </div>
        <div className="min-w-0">
          <ChartByStatus data={dataByStatus} />
        </div>
      </div>

      <div className="min-w-0">
        <ChartByType data={dataByType} />
      </div>

      <div className="min-w-0">
        <ChartTimesheet />
      </div>
    </div>
  );
}
