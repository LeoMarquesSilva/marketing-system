"use client";

import { useMemo } from "react";
import { ActionPlanCard } from "./action-plan-card";
import type { ActionPlan } from "@/lib/clima-types";

const COLUMNS: { id: ActionPlan["priority"]; title: string }[] = [
  { id: "urgente", title: "Faça Primeiro" },
  { id: "programar", title: "Programe" },
  { id: "delegar", title: "Delegue" },
  { id: "nao_fazer", title: "Não Faça" },
];

interface ClimaPlanosTabProps {
  planosAcao: ActionPlan[];
}

export function ClimaPlanosTab({ planosAcao }: ClimaPlanosTabProps) {
  const byColumn = useMemo(() => {
    const map: Record<ActionPlan["priority"], ActionPlan[]> = {
      urgente: [],
      programar: [],
      delegar: [],
      nao_fazer: [],
    };
    planosAcao.forEach((p) => {
      if (map[p.priority]) map[p.priority].push(p);
    });
    return map;
  }, [planosAcao]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Planos de Ação (5W2H)</h2>
        <p className="text-sm text-muted-foreground">
          Board Kanban por prioridade. Clique em "Ver 5W2H completo" para expandir.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="rounded-xl border bg-muted/30 p-4 min-h-[200px]"
          >
            <h3 className="font-semibold text-foreground mb-4">{col.title}</h3>
            <div className="space-y-3">
              {byColumn[col.id].map((plan) => (
                <ActionPlanCard key={plan.id} plan={plan} />
              ))}
              {byColumn[col.id].length === 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  Nenhum plano nesta coluna
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
