"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useHrPendingNotifications } from "@/hooks/use-hr-pending-notifications";
import { HrNotificationsList } from "@/components/rh/hr-notifications-list";
import { FichaColaboradorDialog } from "@/components/rh/ficha-colaborador-dialog";

/**
 * Popup exibido no login para Andressa/Catharina (flag dedicada) e admins
 * quando o sync do VIOS cria um colaborador novo ou muda o status de um
 * existente. Some ao "Fechar", mas volta a aparecer no próximo login
 * enquanto a ficha não for atualizada. Fora do login, o mesmo dado fica
 * acessível a qualquer momento pelo sininho no menu de perfil.
 */
export function HrPendingNotificationsModal() {
  const { canReceive, notifications, refetch } = useHrPendingNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);

  if (!canReceive || dismissed || notifications.length === 0) return null;

  return (
    <>
      <Dialog
        open={!editEmployeeId}
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

          <HrNotificationsList notifications={notifications} onAction={setEditEmployeeId} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FichaColaboradorDialog
        employeeId={editEmployeeId}
        onOpenChange={(open) => !open && setEditEmployeeId(null)}
        onSaved={() => {
          setEditEmployeeId(null);
          void refetch();
        }}
      />
    </>
  );
}
