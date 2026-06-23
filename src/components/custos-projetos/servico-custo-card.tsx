"use client";

import { ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import type { InfraServiceWithPayments } from "@/lib/infra-services";
import {
  matchesPeriodFilter,
  type CustosPeriodFilter,
} from "@/lib/custos-period-filter";
import { cn } from "@/lib/utils";

function formatPeriod(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(iso.includes("T") ? iso : `${iso}T12:00:00`));
}

function ServiceLogo({ service }: { service: InfraServiceWithPayments }) {
  if (service.logo_url) {
    return (
      <div className="h-14 w-14 shrink-0 rounded-2xl border border-border/60 bg-white dark:bg-card overflow-hidden shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={service.logo_url}
          alt=""
          className="h-full w-full object-contain p-1.5"
        />
      </div>
    );
  }

  const colors: Record<string, string> = {
    cursor: "bg-slate-900 text-white",
    "n8n-vps": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    "rd-crm": "bg-blue-600/15 text-blue-700 dark:text-blue-300",
  };

  return (
    <div
      className={cn(
        "h-14 w-14 shrink-0 rounded-2xl border flex items-center justify-center font-bold text-lg",
        colors[service.slug] ?? "bg-violet-500/10 text-violet-700"
      )}
    >
      {service.display_name.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface ServicoCustoCardProps {
  service: InfraServiceWithPayments;
  periodFilter: CustosPeriodFilter;
  onEdit: (service: InfraServiceWithPayments) => void;
}

export function ServicoCustoCard({ service, periodFilter, onEdit }: ServicoCustoCardProps) {
  const hasEstimate = service.estimatedMonthlyBrl > 0 || service.estimatedMonthlyUsd > 0;

  const filteredPayments = service.payments.filter((p) =>
    matchesPeriodFilter(p.period_month, periodFilter)
  );
  const periodPaidUsd = filteredPayments.reduce(
    (sum, p) => sum + (Number(p.amount_usd) || 0),
    0
  );
  const periodPaidBrl = filteredPayments.reduce(
    (sum, p) => sum + (Number(p.amount_brl) || 0),
    0
  );

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-muted/40 to-transparent pb-4">
        <div className="flex flex-wrap items-start gap-4">
          <ServiceLogo service={service} />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{service.display_name}</CardTitle>
              {service.category && (
                <Badge variant="secondary" className="text-xs">
                  {service.category}
                </Badge>
              )}
              {service.provider && (
                <Badge variant="outline" className="text-xs">
                  {service.provider}
                </Badge>
              )}
            </div>
            {service.description && (
              <CardDescription>{service.description}</CardDescription>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(service)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            {service.billing_url && (
              <Button variant="ghost" size="sm" asChild className="gap-1.5">
                <a href={service.billing_url} target="_blank" rel="noopener noreferrer">
                  Faturamento
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Valor mensal
            </p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
              {hasEstimate
                ? service.estimatedMonthlyBrl > 0
                  ? formatBrl(service.estimatedMonthlyBrl)
                  : formatUsd(service.estimatedMonthlyUsd)
                : "—"}
            </p>
            {service.estimatedMonthlyUsd > 0 && service.estimatedMonthlyBrl > 0 && (
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {formatUsd(service.estimatedMonthlyUsd)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pago no período (BRL)
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {periodPaidBrl > 0 ? formatBrl(periodPaidBrl) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pago no período (USD)
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {periodPaidUsd > 0 ? formatUsd(periodPaidUsd) : "—"}
            </p>
          </div>
        </div>

        {filteredPayments.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico de pagamentos</h4>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">BRL</TableHead>
                    <TableHead className="text-right">PTAX</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatPeriod(p.period_month)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {p.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatBrl(p.amount_brl)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {p.usd_brl_rate != null
                          ? Number(p.usd_brl_rate).toLocaleString("pt-BR", {
                              minimumFractionDigits: 4,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {p.amount_usd != null ? formatUsd(Number(p.amount_usd)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : service.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-3">
            Nenhum pagamento registrado. Edite o serviço para informar o valor mensal e adicionar
            histórico.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-3">
            Nenhum pagamento neste período para este serviço.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
