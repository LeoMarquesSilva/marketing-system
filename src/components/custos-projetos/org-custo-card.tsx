"use client";

import { useState } from "react";
import { Building2, ChevronDown, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, type SupabaseOrgBilling } from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import { cn } from "@/lib/utils";

function formatPeriod(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(iso.includes("T") ? iso : `${iso}T12:00:00`));
}

interface OrgCustoCardProps {
  org: SupabaseOrgBilling;
  usdBrlRate: number;
}

export function OrgCustoCard({ org, usdBrlRate }: OrgCustoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const history = org.orgPaymentHistory ?? [];
  const projectCount = org.projects.length;

  return (
    <Card className="border-violet-200/50 dark:border-violet-900/40 bg-violet-500/[0.03] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200/50 bg-violet-500/10">
            <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{org.name}</CardTitle>
              {org.planName && (
                <Badge className="text-[10px] bg-violet-600 text-white hover:bg-violet-600">
                  {org.planName}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] gap-1">
                <Layers className="h-3 w-3" />
                {projectCount} projeto{projectCount !== 1 ? "s" : ""}
              </Badge>
            </div>
            {org.planMonthlyUsd > 0 ? (
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                  {formatBrl(org.planMonthlyUsd * usdBrlRate)}/mês
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ≈ {formatUsd(org.planMonthlyUsd)} · plano base
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Plano gratuito</p>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="px-6 pb-5">
        <p className="mb-2 text-xs text-muted-foreground">
          Cobrança da organização — o plano já inclui os projetos. Não é dividido entre eles.
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-3">
            Sem faturas da organização registradas.
          </p>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors",
                expanded && "border-b border-border/50 bg-muted/10"
              )}
              aria-expanded={expanded}
            >
              <span className="text-sm font-medium">
                {history.length} fatura{history.length !== 1 ? "s" : ""} da organização
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  expanded && "rotate-180"
                )}
                aria-hidden
              />
            </button>

            {expanded && (
              <ul className="divide-y divide-border/50 bg-background/50">
                {history.map((h) => (
                  <li
                    key={`${h.invoiceId}-${h.description}-${h.periodEnd}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{formatPeriod(h.periodEnd)}</span>
                      {h.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[260px] mt-0.5">
                          {h.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <p className="font-semibold">
                        {h.amountBrl != null
                          ? formatBrl(h.amountBrl)
                          : formatBrl(h.amountUsd * usdBrlRate)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatUsd(h.amountUsd)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
