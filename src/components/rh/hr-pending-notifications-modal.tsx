"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { hasHrAccess } from "@/lib/rh/access";
import type { HrOnboardingNotification } from "@/lib/ferias/types";

function describeNotification(notification: HrOnboardingNotification): string {
  const name = notification.employee?.full_name ?? "Colaborador";
  if (notification.event_type === "new_employee") {
    return `${name} foi identificado como novo colaborador pelo VIOS. A ficha ainda precisa ser completada.`;
  }
  const status = notification.new_is_active ? "ativo" : "inativo";
  return `${name} agora está ${status} no VIOS.`;
}

/**
 * Popup exibido no login para Andressa/Catharina (flag dedicada) e admins
 * quando o sync do VIOS cria um colaborador novo ou muda o status de um
 * existente. Some ao "Fechar", mas volta a aparecer no próximo login
 * enquanto a ficha não for atualizada.
 */
export function HrPendingNotificationsModal() {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<HrOnboardingNotification[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const canReceive =
    !!profile &&
    (hasHrAccess(profile.role, profile.permissions) || !!profile.is_hr_notification_recipient);

  const load = useCallback(async () => {
    if (!canReceive) return;
    try {
      const response = await fetch("/api/hr/notifications", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // Falha pontual de rede: não é crítico deixar de notificar desta vez.
    }
  }, [canReceive]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Busca as notificações pendentes assim que o perfil autorizado carrega.
    void load();
  }, [load]);

  if (!canReceive || dismissed || notifications.length === 0) return null;

  function goToFicha(employeeId: string) {
    setDismissed(true);
    router.push(`/rh/ferias?colaborador=${employeeId}`);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setDismissed(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizações de colaboradores (VIOS)</DialogTitle>
          <DialogDescription>
            {notifications.length === 1
              ? "Uma ficha precisa ser atualizada."
              : `${notifications.length} fichas precisam ser atualizadas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {notification.employee?.full_name ?? "Colaborador"}
                </p>
                <p className="text-xs text-muted-foreground">{describeNotification(notification)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => goToFicha(notification.employee_id)}
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
