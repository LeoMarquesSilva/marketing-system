"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, ClipboardList, Loader2, MessageSquareHeart, MessageSquarePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AppNotification } from "@/lib/rh/feedback/types";
import { cn } from "@/lib/utils";
import { PersonPhoto } from "../rh/pdi/pdi-visuals";

const POLL_MS = 120_000;

const KIND_ICON: Record<string, typeof Bell> = {
  feedback_recebido: MessageSquareHeart,
  feedback_resposta: MessageSquareHeart,
  feedback_pedido: MessageSquarePlus,
  feedback_pedido_respondido: MessageSquarePlus,
  feedback_pedido_recusado: MessageSquarePlus,
  feedback_lembrete: BellRing,
  boa_pratica: ClipboardList,
};

function when(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "ontem" : `há ${days} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso)).replace(".", "");
}

/**
 * Sino geral do ORQESTRAI (tabela `notifications`). Hoje traz o feedback; comunicados,
 * 1:1 e PDI entram depois. Enquanto o feedback estiver em teste, só aparece para RH e admin.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notificacoes", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { enabled: boolean; unread: number };
      setEnabled(body.enabled);
      setUnread(body.unread);
    } catch {
      // Sem rede: tenta de novo no próximo ciclo.
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCount();
    }, POLL_MS);
    const onFocus = () => void refreshCount();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCount]);

  async function loadList() {
    setLoading(true);
    try {
      const response = await fetch("/api/notificacoes?lista=1", { cache: "no-store" });
      if (response.ok) {
        const body = (await response.json()) as { unread: number; items: AppNotification[] };
        setItems(body.items);
        setUnread(body.unread);
      }
    } finally {
      setLoading(false);
    }
  }

  async function markRead(ids: string[] | null) {
    await fetch("/api/notificacoes/lidas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) });
    setItems((current) => current?.map((item) => (!ids || ids.includes(item.id) ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item)) ?? null);
    setUnread((current) => (ids ? Math.max(0, current - ids.length) : 0));
  }

  async function openItem(item: AppNotification) {
    if (!item.read_at) await markRead([item.id]);
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  if (!enabled) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadList();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Avisos (${unread} não ${unread === 1 ? "lido" : "lidos"})` : "Avisos"}
          className={cn(
            "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
            className
          )}
        >
          <Bell className="h-4.5 w-4.5 text-white/70 transition-colors group-hover:text-white" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#03070c] bg-[#47cdd0] px-0.5 text-xs font-semibold leading-none text-[#04202f]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-[22rem] p-0">
        <header className="flex items-center justify-between gap-2 border-b border-[#e6eef0] px-4 py-3">
          <p className="text-sm font-semibold text-[#0d2a38]">Avisos</p>
          {unread > 0 && (
            <button type="button" onClick={() => markRead(null)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-[#1d7086] hover:bg-[#eef8f8]">
              <CheckCheck className="size-3.5" aria-hidden />
              Marcar todos como lidos
            </button>
          )}
        </header>
        <div className="max-h-[26rem] overflow-y-auto overscroll-contain [scrollbar-color:#c9d6da_transparent] [scrollbar-width:thin]">
          {loading && !items ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-[#3e84a8]" aria-label="Carregando" />
            </div>
          ) : !items?.length ? (
            <p className="px-4 py-10 text-center text-sm text-[#5a717b]">Nenhum aviso por enquanto.</p>
          ) : (
            <ul className="divide-y divide-[#eef3f5]">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind] ?? Bell;
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => openItem(item)} className={cn("flex w-full gap-3 px-4 py-3 text-left outline-none hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb]", !item.read_at && "bg-[#f1fafa]")}>
                      {item.actor ? (
                        <PersonPhoto person={item.actor} size="sm" />
                      ) : (
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eaf4f6] text-[#1d7086]">
                          <Icon className="size-4" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm leading-snug", item.read_at ? "text-[#3b5560]" : "font-semibold text-[#0d2a38]")}>{item.title}</span>
                        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-[#5a717b]">{item.body}</span>}
                        <span className="mt-1 block text-xs text-[#7b929c]">{when(item.created_at)}</span>
                      </span>
                      {!item.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#1f9ea1]" aria-label="Não lido" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
