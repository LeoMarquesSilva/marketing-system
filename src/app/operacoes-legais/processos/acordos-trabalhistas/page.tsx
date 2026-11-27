import type { Metadata } from "next";
import { AcordosTrabalhistasClient } from "@/components/operacoes-legais/processos/acordos-trabalhistas-client";

export const metadata: Metadata = {
  title: "Processos — Acordos trabalhistas — ORQESTRAI",
  description: "Tentativa de acordo nos processos trabalhistas: e-mails aos advogados dos reclamantes, propostas, risco e valor máximo do cliente.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProcessosAcordosTrabalhistasPage() {
  return <AcordosTrabalhistasClient />;
}
