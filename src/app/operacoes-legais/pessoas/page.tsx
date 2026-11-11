import type { Metadata } from "next";
import { PessoasClient } from "@/components/operacoes-legais/pessoas/pessoas-client";

export const metadata: Metadata = {
  title: "Pessoas — ORQESTRAI",
  description: "Cadastro único de pessoas: clientes, partes, sócios, fiadores e advogados.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PessoasPage() {
  return <PessoasClient />;
}
