"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Megaphone, MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsappUnreadCount } from "@/hooks/use-whatsapp-unread";

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
  const [tab, setTab] = useState<Tab>("anuncios");
  const whatsappUnread = useWhatsappUnreadCount();

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Seções de tráfego pago"
        className="flex gap-1 p-1 rounded-xl bg-muted/50 border w-fit"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "anuncios"}
          aria-controls="tab-panel-anuncios"
          id="tab-anuncios"
          onClick={() => setTab("anuncios")}
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === "whatsapp"}
          aria-controls="tab-panel-whatsapp"
          id="tab-whatsapp"
          onClick={() => setTab("whatsapp")}
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
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
              {whatsappUnread > 99 ? "99+" : whatsappUnread}
            </span>
          )}
        </button>
      </div>

      {tab === "anuncios" ? (
        <section
          role="tabpanel"
          id="tab-panel-anuncios"
          aria-labelledby="tab-anuncios"
        >
          <TrafegoPagoClient />
        </section>
      ) : (
        <section
          role="tabpanel"
          id="tab-panel-whatsapp"
          aria-labelledby="tab-whatsapp"
        >
          <WhatsappInbox />
        </section>
      )}
    </div>
  );
}
