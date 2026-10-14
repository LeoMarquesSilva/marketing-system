import type { Metadata } from "next";
import { ConferenciaClient } from "@/components/operacoes-legais/vistagem/conferencia-client";

export const metadata: Metadata = {
  title: "Vistagem — Conferência — ORQESTRAI",
  description: "Conferência da vistagem pela controladoria e envio ao robô de agendamento.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function VistagemConferenciaPage() {
  return <ConferenciaClient />;
}
