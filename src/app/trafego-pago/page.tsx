import nextDynamic from "next/dynamic";
import TrafegoPagoLoading from "./loading";

const TrafegoPagoTabs = nextDynamic(
  () =>
    import("@/components/trafego-pago/trafego-pago-tabs").then((m) => ({
      default: m.TrafegoPagoTabs,
    })),
  { loading: () => <TrafegoPagoLoading /> }
);

// O nome da tela já vem do cabeçalho global (h1); aqui só as abas e o conteúdo.
export default function TrafegoPagoPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <TrafegoPagoTabs />
    </div>
  );
}
