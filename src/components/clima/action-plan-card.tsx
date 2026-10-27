"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { resolveResponsibles, type ThemeSummary } from "@/lib/clima-metrics";
import type { ActionPlan } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { PeopleAvatars, PlanStatusBadge, favorableTextClass } from "./clima-visuals";

const PRIORITY_LABELS: Record<ActionPlan["priority"], string> = {
  urgente: "Faça Primeiro",
  programar: "Programe",
  delegar: "Delegue",
  nao_fazer: "Não Faça",
};

const PRIORITY_COLORS: Record<ActionPlan["priority"], string> = {
  urgente: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  programar: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  delegar: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  nao_fazer: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

interface ActionPlanCardProps {
  plan: ActionPlan;
  themes: ThemeSummary[];
  users: User[];
  className?: string;
}

export function ActionPlanCard({ plan, themes, users, className }: ActionPlanCardProps) {
  const planThemes = themes.filter((t) => plan.themeIds?.includes(t.theme.id));
  const [expanded, setExpanded] = useState(false);

  const fields = [
    { key: "what", label: "O quê" },
    { key: "why", label: "Por quê" },
    { key: "who", label: "Quem" },
    { key: "where", label: "Onde" },
    { key: "when", label: "Quando" },
    { key: "how", label: "Como" },
    { key: "howMuch", label: "Quanto" },
  ] as const;

  return (
    <Card
      className={cn(
        "rounded-xl border shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground">{plan.title}</h3>
          <Badge
            variant="outline"
            className={cn("shrink-0 text-xs", PRIORITY_COLORS[plan.priority])}
          >
            {PRIORITY_LABELS[plan.priority]}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <PeopleAvatars people={resolveResponsibles(plan.responsible, users)} className="w-0 min-w-0 flex-1" />
          <PlanStatusBadge status={plan.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {plan.what}
        </p>
        {planThemes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {planThemes.map((t) => (
              <span key={t.theme.id} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {t.theme.name} ·{" "}
                <span className={cn("font-medium", favorableTextClass(t.favorability.favorable))}>
                  {Math.round(t.favorability.favorable)}%
                </span>
              </span>
            ))}
          </div>
        )}
        {expanded && (
          <div className="space-y-3 border-t pt-3">
            {fields.slice(1).map(({ key, label }) => {
              const value = plan[key];
              if (!value) return null;
              return (
                <div key={key}>
                  <span className="text-xs font-medium text-muted-foreground">
                    {label}:
                  </span>
                  <p className="text-sm">{value}</p>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Ocultar detalhes
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Ver 5W2H completo
            </>
          )}
        </button>
      </CardContent>
    </Card>
  );
}
