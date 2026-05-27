import { Megaphone } from "lucide-react";
import nextDynamic from "next/dynamic";
import TrafegoPagoLoading from "./loading";

const TrafegoPagoTabs = nextDynamic(
  () =>
    import("@/components/trafego-pago/trafego-pago-tabs").then((m) => ({
      default: m.TrafegoPagoTabs,
    })),
  { loading: () => <TrafegoPagoLoading /> }
);

export const dynamic = "force-dynamic";

export default function TrafegoPagoPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Megaphone className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Tráfego Pago</h2>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Acompanhe a performance dos anúncios da Meta e interaja com os leads que chegam no WhatsApp via Evolution API.
        </p>
      </div>
      <TrafegoPagoTabs />
    </div>
  );
}
