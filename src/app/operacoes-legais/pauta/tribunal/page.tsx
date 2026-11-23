import type { Metadata } from "next";
import { TribunalClient } from "@/components/operacoes-legais/pauta/tribunal-client";

export const metadata: Metadata = {
  title: "Conferência no tribunal — ORQESTRAI",
  description: "O que mudou no PJe e no DJEN nas audiências da pauta.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function TribunalPage() {
  return <TribunalClient />;
}
