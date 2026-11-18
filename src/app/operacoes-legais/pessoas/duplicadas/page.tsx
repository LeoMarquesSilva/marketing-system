import type { Metadata } from "next";
import { DuplicadasClient } from "@/components/operacoes-legais/pessoas/duplicadas-client";

export const metadata: Metadata = {
  title: "Pessoas — Repetidas — ORQESTRAI",
  description: "Pessoas que parecem a mesma, para conferir e unificar.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PessoasDuplicadasPage() {
  return <DuplicadasClient />;
}
