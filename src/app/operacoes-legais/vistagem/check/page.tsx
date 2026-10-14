import type { Metadata } from "next";
import { CheckClient } from "@/components/operacoes-legais/vistagem/check-client";

export const metadata: Metadata = {
  title: "Vistagem — Check dos agendamentos — ORQESTRAI",
  description: "Check final da esteira e do agendamento no VIOS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function VistagemCheckPage() {
  return <CheckClient />;
}
