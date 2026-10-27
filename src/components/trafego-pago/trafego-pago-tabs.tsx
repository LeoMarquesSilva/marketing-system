"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Megaphone, MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsappUnreadCount } from "@/hooks/use-whatsapp-unread";
import { WHATSAPP_CONVERSATION_PARAM } from "@/lib/whatsapp-lead-push";

type Tab = "anuncios" | "whatsapp";

function TabLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

const TrafegoPagoClient = dynamic(
  () =>
    import("@/components/trafego-pago/trafego-pago-client").then((m) => ({
      default: m.TrafegoPagoClient,
    })),
  { loading: () => <TabLoading label="Carregando anúncios Meta…" /> }
);

const WhatsappInbox = dynamic(
  () =>
    import("@/components/trafego-pago/whatsapp-inbox").then((m) => ({
      default: m.WhatsappInbox,
    })),
  { loading: () => <TabLoading label="Carregando inbox WhatsApp…" /> }
);

export function TrafegoPagoTabs() {
  // Atendimento é o uso do dia a dia: abre primeiro. Anúncios só carregam quando visitados.
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [adsVisited, setAdsVisited] = useState(false);
  const openTab = (next: Tab) => {
    setTab(next);
    if (next === "anuncios") setAdsVisited(true);
  };
  const whatsappUnread = useWhatsappUnreadCount();
  // Clique no aviso de lead (?conversa=<id>): a conversa abre na aba de atendimento.
  const conversationParam = useSearchParams().get(WHATSAPP_CONVERSATION_PARAM);
  useEffect(() => {
    if (conversationParam) setTab("whatsapp");
  }, [conversationParam]);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Seções de tráfego pago"
        className="flex gap-1 p-1 rounded-xl bg-muted/50 border w-fit"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "whatsapp"}
          aria-controls="tab-panel-whatsapp"
          id="tab-whatsapp"
          onClick={() => openTab("whatsapp")}
          className={cn(
            "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            tab === "whatsapp"
              ? "bg-white dark:bg-card shadow-sm text-[#04202f]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageCircle className="h-4 w-4" />
          Leads WhatsApp
          {whatsappUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#47cdd0] px-1.5 text-xs font-semibold text-[#1c1c1c]">
              {whatsappUnread > 99 ? "99+" : whatsappUnread}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "anuncios"}
          aria-controls="tab-panel-anuncios"
          id="tab-anuncios"
          onClick={() => openTab("anuncios")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            tab === "anuncios"
              ? "bg-white dark:bg-card shadow-sm text-[#04202f]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Megaphone className="h-4 w-4" />
          Anúncios Meta
        </button>
      </div>

      {/* Depois de abertas, as seções ficam montadas — só a visibilidade
          alterna. Desmontar ao trocar de aba fazia o WhatsApp Inbox perder
          todo o estado (lista, conversa aberta, mensagens) e recarregar do
          zero toda vez que o usuário voltava pra essa aba. */}
      <section
        role="tabpanel"
        id="tab-panel-whatsapp"
        aria-labelledby="tab-whatsapp"
        hidden={tab !== "whatsapp"}
      >
        <WhatsappInbox />
      </section>
      <section
        role="tabpanel"
        id="tab-panel-anuncios"
        aria-labelledby="tab-anuncios"
        hidden={tab !== "anuncios"}
      >
        {adsVisited && <TrafegoPagoClient />}
      </section>
    </div>
  );
}
