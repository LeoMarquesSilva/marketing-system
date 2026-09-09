"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHrPendingNotifications } from "@/hooks/use-hr-pending-notifications";
import { HrNotificationsList } from "@/components/rh/hr-notifications-list";
import { FichaColaboradorDialog } from "@/components/rh/ficha-colaborador-dialog";
import { cn } from "@/lib/utils";

/**
 * Sininho de acesso permanente às notificações de onboarding de RH (VIOS) —
 * complementa o popup automático do login: aqui dá pra rever/agir a qualquer
 * momento, não só assim que loga.
 */
export function HrNotificationsBell({ className }: { className?: string }) {
  const { canReceive, notifications, refetch } = useHrPendingNotifications();
  const [open, setOpen] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);

  if (!canReceive) return null;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void refetch();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={
              notifications.length > 0
                ? `Notificações de RH (${notifications.length} pendente${notifications.length > 1 ? "s" : ""})`
                : "Notificações de RH"
            }
            className={cn(
              "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
              className
            )}
          >
            <Bell className="h-4.5 w-4.5 text-white/70 transition-colors group-hover:text-white" />
            {notifications.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#03070c] bg-red-500 px-0.5 text-[9px] font-semibold leading-none text-white">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="right" className="p-3">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Atualizações de colaboradores (VIOS)
          </p>
          <HrNotificationsList
            notifications={notifications}
            onAction={(employeeId) => {
              setOpen(false);
              setEditEmployeeId(employeeId);
            }}
          />
        </PopoverContent>
      </Popover>

      <FichaColaboradorDialog
        employeeId={editEmployeeId}
        onOpenChange={(nextOpen) => !nextOpen && setEditEmployeeId(null)}
        onSaved={() => {
          setEditEmployeeId(null);
          void refetch();
        }}
      />
    </>
  );
}
