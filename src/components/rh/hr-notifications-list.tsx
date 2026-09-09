"use client";

import { RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HrOnboardingNotification } from "@/lib/ferias/types";

export function describeHrNotification(notification: HrOnboardingNotification): string {
  const name = notification.employee?.full_name ?? "Colaborador";
  if (notification.event_type === "new_employee") {
    return `${name} foi identificado como novo colaborador pelo VIOS. A ficha ainda precisa ser completada.`;
  }
  const status = notification.new_is_active ? "ativo" : "inativo";
  return `${name} agora está ${status} no VIOS.`;
}

export function HrNotificationsList({
  notifications,
  onAction,
}: {
  notifications: HrOnboardingNotification[];
  onAction: (employeeId: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Nenhuma atualização pendente.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="flex items-start justify-between gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{notification.employee?.full_name ?? "Colaborador"}</p>
            <p className="text-xs text-muted-foreground">{describeHrNotification(notification)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => onAction(notification.employee_id)}
          >
            {notification.event_type === "new_employee" ? (
              <UserPlus className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Atualizar informações
          </Button>
        </div>
      ))}
    </div>
  );
}
