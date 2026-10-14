import type { Metadata } from "next";
import { CapturaClient } from "@/components/operacoes-legais/vistagem/captura-client";

export const metadata: Metadata = {
  title: "Vistagem — Captura — ORQESTRAI",
  description: "Captura diária das publicações da Kurier.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function VistagemCapturaPage() {
  return <CapturaClient />;
}
