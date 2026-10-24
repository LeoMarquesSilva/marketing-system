"use client";

import { useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContentScheduleNotificationsList } from "@/components/conteudo/content-schedule-notifications-list";
import { OpsNotificationsList, useOpsNotifications } from "@/components/ops-planner/ops-notifications-list";
import { FichaColaboradorDialog } from "@/components/rh/ficha-colaborador-dialog";
import { HrNotificationsList } from "@/components/rh/hr-notifications-list";
import { useContentScheduleNotifications } from "@/hooks/use-content-schedule-notifications";
import { useHrPendingNotifications } from "@/hooks/use-hr-pending-notifications";
import { cn } from "@/lib/utils";

function Section({ title, count, action, children }: { title: string; count: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-slate-200 px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          {count > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">{count}</span>}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Sino único da sidebar: junta os avisos do Planner Ops, as atualizações de
 * colaboradores do RH e os ajustes do calendário editorial no VIOS. Cada seção
 * só aparece para quem recebe aquele tipo de aviso.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const ops = useOpsNotifications();
  const hr = useHrPendingNotifications();
  const content = useContentScheduleNotifications();
  const [open, setOpen] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);

  if (!ops.canReceive && !hr.canReceive && !content.canReceive) return null;

  const total =
    (ops.canReceive ? ops.unread : 0) +
    (hr.canReceive ? hr.pendingCount : 0) +
    (content.canReceive ? content.notifications.length : 0);
  const close = () => setOpen(false);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) return;
          if (ops.canReceive) void ops.load();
          if (hr.canReceive) void hr.refetch();
          if (content.canReceive) void content.load();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={total > 0 ? `Avisos (${total} pendente${total > 1 ? "s" : ""})` : "Avisos"}
            className={cn(
              "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
              className
            )}
          >
            <Bell className="h-4.5 w-4.5 text-white/70 transition-colors group-hover:text-white" />
            {total > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#03070c] bg-red-500 px-0.5 text-[9px] font-semibold leading-none text-white">
                {total > 9 ? "9+" : total}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="right"
          collisionPadding={12}
          className="flex max-h-[min(80dvh,40rem)] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0"
        >
          <div className="min-h-0 overflow-y-auto">
            {ops.canReceive && (
              <Section
                title="Planner Ops"
                count={ops.unread}
                action={
                  ops.unread > 0 && (
                    <button type="button" className="text-xs text-[#285f7a] hover:underline" onClick={() => void ops.markRead({ all: true })}>
                      Marcar como lidos
                    </button>
                  )
                }
              >
                <OpsNotificationsList items={ops.items} onMarkRead={(body) => void ops.markRead(body)} onNavigate={close} />
              </Section>
            )}
            {hr.canReceive && (
              <Section title="Atualizações de colaboradores" count={hr.pendingCount}>
                <HrNotificationsList
                  notifications={hr.notifications}
                  orgChartAdjustments={hr.orgChartAdjustments}
                  onAction={(employeeId) => {
                    close();
                    setEditEmployeeId(employeeId);
                  }}
                  onNavigate={close}
                  onChanged={() => void hr.refetch()}
                />
              </Section>
            )}
            {content.canReceive && (
              <Section title="Calendário editorial → VIOS" count={content.notifications.length}>
                <ContentScheduleNotificationsList
                  notifications={content.notifications}
                  loading={content.loading}
                  resolvingId={content.resolvingId}
                  error={content.error}
                  onResolve={(notification) => void content.resolve(notification)}
                  onNavigate={close}
                />
              </Section>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {hr.canReceive && (
        <FichaColaboradorDialog
          employeeId={editEmployeeId}
          onOpenChange={(nextOpen) => !nextOpen && setEditEmployeeId(null)}
          onSaved={() => {
            setEditEmployeeId(null);
            void hr.refetch();
          }}
        />
      )}
    </>
  );
}
