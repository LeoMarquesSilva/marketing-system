"use client";

import {
  ExternalLink,
  Pencil,
  Server,
} from "lucide-react";
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
import { formatUsd, type SupabaseProjectBilling } from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import {
  matchesPeriodFilter,
  type CustosPeriodFilter,
} from "@/lib/custos-period-filter";
import { cn } from "@/lib/utils";

function formatPeriod(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function ProjectLogo({
  project,
  size = "lg",
}: {
  project: SupabaseProjectBilling;
  size?: "lg" | "md";
}) {
  const dim = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const text = size === "lg" ? "text-lg" : "text-sm";

  if (project.logoUrl) {
    return (
      <div
        className={cn(
          dim,
          "shrink-0 rounded-2xl border border-border/60 bg-white dark:bg-card overflow-hidden shadow-sm"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.logoUrl}
          alt=""
          className="h-full w-full object-contain p-1.5"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        dim,
        "shrink-0 rounded-2xl border border-violet-200/50 bg-violet-500/10 flex items-center justify-center"
      )}
    >
      <span className={cn("font-bold text-violet-700 dark:text-violet-300", text)}>
        {project.displayName.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

interface ProjetoCustoCardProps {
  project: SupabaseProjectBilling;
  periodFilter: CustosPeriodFilter;
  onEdit: (project: SupabaseProjectBilling) => void;
}

export function ProjetoCustoCard({ project, periodFilter, onEdit }: ProjetoCustoCardProps) {
  const dashboardUrl = `https://supabase.com/dashboard/project/${project.ref}`;

  const filteredHistory = project.paymentHistory.filter((h) =>
    matchesPeriodFilter(h.periodEnd, periodFilter)
  );
  const periodPaidUsd = filteredHistory.reduce((sum, h) => sum + h.amountUsd, 0);
  const periodPaidBrl = filteredHistory.reduce((sum, h) => sum + (h.amountBrl ?? 0), 0);

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-muted/40 to-transparent pb-4">
        <div className="flex flex-wrap items-start gap-4">
          <ProjectLogo project={project} />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{project.displayName}</CardTitle>
              {project.category && (
                <Badge variant="secondary" className="text-xs">
                  {project.category}
                </Badge>
              )}
            </div>
            {project.description && (
              <CardDescription className="text-sm">{project.description}</CardDescription>
            )}
            <p className="text-xs text-muted-foreground font-mono">{project.ref}</p>
            <p className="text-xs text-muted-foreground">
              {project.region} · {project.status.replace(/_/g, " ")}
              {project.supabaseName !== project.displayName && (
                <> · Supabase: {project.supabaseName}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(project)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button variant="ghost" size="sm" asChild className="gap-1.5">
              <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                Dashboard
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estimativa mensal
            </p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
              {formatUsd(project.estimatedMonthlyUsd)}
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
          <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pago no período (BRL)
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {periodPaidBrl > 0 ? formatBrl(periodPaidBrl) : "—"}
            </p>
          </div>
        </div>

        {project.addons.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              Infraestrutura
            </h4>
            <div className="flex flex-wrap gap-2">
              {project.addons.map((a) => (
                <Badge key={`${a.type}-${a.name}`} variant="outline" className="text-xs py-1.5">
                  {a.name}: {a.priceDescription}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {filteredHistory.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico de pagamentos</h4>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                    <TableHead className="text-right">PTAX</TableHead>
                    <TableHead className="text-right">BRL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((h) => (
                    <TableRow key={`${h.invoiceId}-${h.description}-${h.periodEnd}`}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatPeriod(h.periodEnd)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {h.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatUsd(h.amountUsd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {h.usdBrlRate != null
                          ? h.usdBrlRate.toLocaleString("pt-BR", { minimumFractionDigits: 4 })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatBrl(h.amountBrl)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : project.paymentHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-3">
            Nenhum pagamento sincronizado ainda para este projeto.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-3">
            Nenhum pagamento neste período para este projeto.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
