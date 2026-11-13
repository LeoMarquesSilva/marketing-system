"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, AlertTriangle, CalendarClock, MessageSquare, Repeat, UserPlus, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasOpsPlannerAccess } from "@/lib/access-control";
import { OPS_PLANNER_PATH, type OpsNotification, type OpsNotificationKind } from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { opsApi } from "./ops-client";
import { formatDateTime } from "./ops-ui";

const KIND_ICON: Record<OpsNotificationKind, { icon: LucideIcon; tone: string }> = {
  rotina_gerada: { icon: Repeat, tone: "text-[#48466e]" },
  vence_amanha: { icon: CalendarClock, tone: "text-[#285f7a]" },
  vence_hoje: { icon: AlarmClock, tone: "text-amber-600" },
  atrasada: { icon: AlertTriangle, tone: "text-red-600" },
  escalada: { icon: AlertTriangle, tone: "text-red-600" },
  atribuida: { icon: UserPlus, tone: "text-[#285f7a]" },
  comentario: { icon: MessageSquare, tone: "text-[#285f7a]" },
};

/** Avisos do Planner de Operações Legais para o sino da sidebar. */
export function useOpsNotifications() {
  const { profile } = useAuth();
  const enabled = hasOpsPlannerAccess(profile);
  const [items, setItems] = useState<OpsNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await opsApi.get<{ items: OpsNotification[]; unread: number }>("/notifications");
      setItems(data.items);
      setUnread(data.unread);
      setAvailable(true);
    } catch {
      // Sem espaço ou módulo ainda sem banco: a seção some em vez de mostrar erro.
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await opsApi.get<{ items: OpsNotification[]; unread: number }>("/notifications");
        if (cancelled) return;
        setItems(data.items);
        setUnread(data.unread);
        setAvailable(true);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  const markRead = useCallback(
    async (body: { ids: string[] } | { all: true }) => {
      try {
        await opsApi.post("/notifications", body);
        await load();
      } catch {
        // Marcar como lido é opcional; o aviso continua na lista.
      }
    },
    [load]
  );

  return { canReceive: enabled && available, items, unread, load, markRead };
}

export function OpsNotificationsList({
  items,
  onMarkRead,
  onNavigate,
}: {
  items: OpsNotification[];
  onMarkRead: (body: { ids: string[] } | { all: true }) => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  if (items.length === 0) return <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const { icon: Icon, tone } = KIND_ICON[item.kind] ?? KIND_ICON.atribuida;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                if (!item.read_at) onMarkRead({ ids: [item.id] });
                router.push(item.task_id ? `${OPS_PLANNER_PATH}?tarefa=${item.task_id}` : OPS_PLANNER_PATH);
              }}
              className={cn("flex w-full gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent", !item.read_at && "bg-[#e8f8f8]/60")}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm leading-snug", !item.read_at && "font-semibold")}>{item.title}</span>
                {item.body && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.body}</span>}
                <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
