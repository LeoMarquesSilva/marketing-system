"use client";

import { ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InfraServiceWithPayments } from "@/lib/infra-services";
import type { HostingerBillingDashboard } from "@/lib/hostinger-billing";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import { ServicoExecutivePanel } from "@/components/custos-projetos/servico-executive-panel";

function ServiceLogo({ service }: { service: InfraServiceWithPayments }) {
  if (service.logo_url) {
    return (
      <div className="h-11 w-11 shrink-0 rounded-xl border border-border/60 bg-white dark:bg-card overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={service.logo_url} alt="" className="h-full w-full object-contain p-1" />
      </div>
    );
  }

  const colors: Record<string, string> = {
    cursor: "bg-slate-900 text-white",
    "n8n-vps": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  };

  return (
    <div
      className={cn(
        "h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center font-bold text-sm",
        colors[service.slug] ?? "bg-violet-500/10 text-violet-700"
      )}
    >
      {service.display_name.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface ServicoCustoCardProps {
  service: InfraServiceWithPayments;
  onEdit: (service: InfraServiceWithPayments) => void;
  usdBrlRate: number;
  hostingerLive?: HostingerBillingDashboard | null;
  hostingerError?: string | null;
}

export function ServicoCustoCard({
  service,
  onEdit,
  usdBrlRate,
  hostingerLive,
  hostingerError,
}: ServicoCustoCardProps) {
  const isCursor = service.slug === "cursor";
  const isN8n = service.slug === "n8n-vps";

  // Custo mensal em destaque: Cursor é cobrado em USD (converte p/ BRL);
  // N8N/VPS já vem em BRL (prioriza o preço de renovação ao vivo da Hostinger).
  const monthlyUsd = service.estimatedMonthlyUsd || Number(service.monthly_amount_usd) || 0;
  const monthlyBrl = isN8n
    ? hostingerLive?.subscription?.renewalPrice ||
      service.estimatedMonthlyBrl ||
      Number(service.monthly_amount_brl) ||
      0
    : monthlyUsd * usdBrlRate;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <ServiceLogo service={service} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{service.display_name}</CardTitle>
              {isCursor && Number(service.monthly_amount_usd) === 60 && (
                <Badge className="text-[10px] bg-slate-900 text-white">Pro+</Badge>
              )}
              {isN8n && hostingerLive?.subscription && (
                <Badge variant="secondary" className="text-[10px]">
                  {hostingerLive.subscription.name}
                </Badge>
              )}
            </div>
            {monthlyBrl > 0 && (
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatBrl(monthlyBrl)}/mês
                </span>
                {!isN8n && monthlyUsd > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ≈ {formatUsd(monthlyUsd)}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => onEdit(service)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            {service.billing_url && (
              <Button variant="ghost" size="sm" className="h-8" asChild>
                <a href={service.billing_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isN8n && hostingerError && (
        <p className="text-xs text-amber-700 dark:text-amber-400 px-6 pb-3">{hostingerError}</p>
      )}

      <div className="px-6 pb-5">
        <ServicoExecutivePanel
          service={service}
          hostingerLive={hostingerLive}
          isN8n={isN8n}
        />
      </div>
    </Card>
  );
}
