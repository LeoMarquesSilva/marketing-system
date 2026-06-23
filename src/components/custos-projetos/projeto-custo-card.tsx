"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, type SupabaseProjectBilling } from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import { cn } from "@/lib/utils";

function formatPeriod(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(iso.includes("T") ? iso : `${iso}T12:00:00`));
}

function ProjectLogo({ project }: { project: SupabaseProjectBilling }) {
  if (project.logoUrl) {
    return (
      <div className="h-11 w-11 shrink-0 rounded-xl border border-border/60 bg-white dark:bg-card overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={project.logoUrl} alt="" className="h-full w-full object-contain p-1" />
      </div>
    );
  }

  return (
    <div className="h-11 w-11 shrink-0 rounded-xl border border-violet-200/50 bg-violet-500/10 flex items-center justify-center">
      <span className="font-bold text-sm text-violet-700 dark:text-violet-300">
        {project.displayName.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

interface ProjetoCustoCardProps {
  project: SupabaseProjectBilling;
  onEdit: (project: SupabaseProjectBilling) => void;
  usdBrlRate: number;
}

export function ProjetoCustoCard({ project, onEdit, usdBrlRate }: ProjetoCustoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const dashboardUrl = `https://supabase.com/dashboard/project/${project.ref}`;
  const history = [...project.paymentHistory].sort((a, b) =>
    b.periodEnd.localeCompare(a.periodEnd)
  );

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <ProjectLogo project={project} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{project.displayName}</CardTitle>
              {project.category && (
                <Badge variant="secondary" className="text-[10px]">
                  {project.category}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {project.estimatedMonthlyUsd > 0
                  ? `${formatBrl(project.estimatedMonthlyUsd * usdBrlRate)}/mês`
                  : "Plano incluso"}
              </span>
              {project.estimatedMonthlyUsd > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  ≈ {formatUsd(project.estimatedMonthlyUsd)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => onEdit(project)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button variant="ghost" size="sm" className="h-8" asChild>
              <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="px-6 pb-5">
        {history.length === 0 && project.addons.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-3">
            Sem histórico de pagamentos cadastrado.
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
                {history.length} fatura{history.length !== 1 ? "s" : ""}
                {project.addons.length > 0 && ` · ${project.addons.length} add-on${project.addons.length !== 1 ? "s" : ""}`}
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
              <div className="px-4 py-3 space-y-3 bg-background/50">
                {project.addons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.addons.map((a) => (
                      <Badge key={`${a.type}-${a.name}`} variant="outline" className="text-[10px]">
                        {a.name}: {a.priceDescription}
                      </Badge>
                    ))}
                  </div>
                )}

                {history.length > 0 && (
                  <ul className="divide-y divide-border/50 rounded-lg border border-border/40 overflow-hidden">
                    {history.map((h) => (
                      <li
                        key={`${h.invoiceId}-${h.description}-${h.periodEnd}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm bg-background/80"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{formatPeriod(h.periodEnd)}</span>
                          {h.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[240px] mt-0.5">
                              {h.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right tabular-nums shrink-0">
                          <p className="font-semibold">{formatBrl(h.amountBrl)}</p>
                          <p className="text-xs text-muted-foreground">{formatUsd(h.amountUsd)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
