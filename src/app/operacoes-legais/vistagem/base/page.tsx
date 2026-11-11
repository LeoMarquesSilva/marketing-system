import type { Metadata } from "next";
import { CapturaClient } from "@/components/operacoes-legais/vistagem/captura-client";

export const metadata: Metadata = {
  title: "Vistagem — Gestão das publicações — ORQESTRAI",
  description: "Arquivo do dia da Kurier, envio do xlsx, publicações coladas e para onde foi cada publicação.",
  robots: { index: false, follow: false },
};

export default function VistagemGestaoDaBasePage() {
  return <CapturaClient />;
}
