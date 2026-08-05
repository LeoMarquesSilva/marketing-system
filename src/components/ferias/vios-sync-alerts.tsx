"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViosSyncAlerts } from "@/lib/ferias/types";
import { cn } from "@/lib/utils";

interface ViosSyncAlertsBannerProps {
  alerts: ViosSyncAlerts;
  onRegisterClick?: () => void;
}

function formatSyncedAt(value: string | null): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export function ViosSyncAlertsBanner({ alerts, onRegisterClick }: ViosSyncAlertsBannerProps) {
  const [open, setOpen] = useState(true);
  const unmatchedCount = alerts.unmatched.length;
  const missingCount = alerts.missingFromExport.length;
  const total = unmatchedCount + missingCount;

  if (total === 0) return null;

  const syncedLabel = formatSyncedAt(alerts.lastSyncedAt);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              Sync VIOS: {total === 1 ? "1 alerta" : `${total} alertas`}
            </p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              {unmatchedCount > 0
                ? `${unmatchedCount} no VIOS sem cadastro aqui`
                : null}
              {unmatchedCount > 0 && missingCount > 0 ? " · " : null}
              {missingCount > 0
                ? `${missingCount} cadastrado${missingCount === 1 ? "" : "s"} ausente${missingCount === 1 ? "" : "s"} do export`
                : null}
              {syncedLabel ? ` · último sync ${syncedLabel}` : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unmatchedCount > 0 && onRegisterClick ? (
            <Button type="button" size="sm" variant="outline" onClick={onRegisterClick}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Cadastrar
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-amber-900"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="sr-only">{open ? "Recolher" : "Expandir"}</span>
          </Button>
        </div>
      </div>

      {open ? (
        <div className="grid gap-3 border-t border-amber-200/80 px-4 py-3 lg:grid-cols-2">
          {unmatchedCount > 0 ? (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900/70">
                <UserPlus className="h-3.5 w-3.5" />
                Sem cadastro — cadastre manualmente
              </h3>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
                {alerts.unmatched.map((row) => (
                  <li
                    key={row.ci}
                    className="rounded-lg border border-amber-100 bg-white/70 px-3 py-2"
                  >
                    <p className="font-medium text-foreground">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      CI {row.ci}
                      {row.email ? ` · ${row.email}` : ""}
                      {row.department ? ` · ${row.department}` : ""}
                      {row.situation ? ` · ${row.situation}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {missingCount > 0 ? (
            <section className={cn(unmatchedCount === 0 && "lg:col-span-2")}>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900/70">
                <UserX className="h-3.5 w-3.5" />
                Cadastrados ausentes do export (não desativados)
              </h3>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
                {alerts.missingFromExport.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-amber-100 bg-white/70 px-3 py-2"
                  >
                    <p className="font-medium text-foreground">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.email ?? "sem e-mail"}
                      {row.department ? ` · ${row.department}` : ""}
                      {row.vios_ci ? ` · CI ${row.vios_ci}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
