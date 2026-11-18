import type { Metadata } from "next";
import { PautaClient } from "@/components/operacoes-legais/pauta/pauta-client";

export const metadata: Metadata = {
  title: "Pauta de Audiências — ORQESTRAI",
  description: "Pauta de audiências da área trabalhista, lida do PJe e conferida no VIOS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PautaPage() {
  return <PautaClient />;
}
