import type { Metadata } from "next";
import { VisaoGeralClient } from "@/components/operacoes-legais/vistagem/visao-geral-client";

export const metadata: Metadata = {
  title: "Vistagem — Visão geral — ORQESTRAI",
  description: "Resumo da Vistagem: onde estão as publicações, quanto cada vistador tem para vistar e o que chegou da Kurier.",
  robots: { index: false, follow: false },
};

export default function VistagemVisaoGeralPage() {
  return <VisaoGeralClient />;
}
