"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
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
  const router = useRouter();
  const { canReceive, notifications, orgChartAdjustments, refetch } = useHrPendingNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);

  if (!canReceive || dismissed || (notifications.length === 0 && orgChartAdjustments === 0)) return null;

  const submitted = notifications.filter((item) => item.event_type === "registration_submitted").length;
  const viosUpdates = notifications.length - submitted;
  const summary =
    [
      submitted ? (submitted === 1 ? "1 ficha para revisar" : `${submitted} fichas para revisar`) : null,
      viosUpdates
        ? viosUpdates === 1
          ? "1 colaborador para atualizar"
          : `${viosUpdates} colaboradores para atualizar`
        : null,
      orgChartAdjustments ? "organograma para ajustar" : null,
    ]
      .filter(Boolean)
      .join(" · ") + ".";

  return (
    <>
      <Dialog
        open={!editEmployeeId}
        onOpenChange={(open) => {
          if (!open) setDismissed(true);
        }}
      >
        {/* Altura limitada à tela: só a lista rola, título e botões ficam visíveis. */}
        <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizações de colaboradores</DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>

          <div className="-mx-2 min-h-0 overflow-y-auto px-2">
            <HrNotificationsList
              notifications={notifications}
              orgChartAdjustments={orgChartAdjustments}
              onAction={setEditEmployeeId}
              onNavigate={() => setDismissed(true)}
              onChanged={() => void refetch()}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
              Fechar
            </Button>
            {submitted > 1 && (
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => {
                  setDismissed(true);
                  router.push("/rh/fichas-cadastrais?ficha_status=para_revisar");
                }}
              >
                <ClipboardCheck className="h-4 w-4" />
                Ver todas para revisar
              </Button>
            )}
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
