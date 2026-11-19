import type { Metadata } from "next";
import { DistribuicaoClient } from "@/components/operacoes-legais/pauta/distribuicao-client";

export const metadata: Metadata = {
  title: "Distribuição da pauta — ORQESTRAI",
  description: "Tela da reunião diária: titular e backup dos próximos dias úteis.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function DistribuicaoPage() {
  return <DistribuicaoClient />;
}
