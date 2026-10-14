import type { Metadata } from "next";
import { ControladoriaClient } from "@/components/operacoes-legais/vistagem/controladoria-client";

export const metadata: Metadata = {
  title: "Vistagem — Controladoria — ORQESTRAI",
  description: "Pendências de triagem e publicações de ex-clientes.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function VistagemControladoriaPage() {
  return <ControladoriaClient />;
}
