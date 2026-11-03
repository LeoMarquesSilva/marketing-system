import type { Metadata } from "next";
import { PesquisasClient } from "@/components/pesquisas/pesquisas-client";

export const metadata: Metadata = {
  title: "Pesquisas com a equipe — ORQESTRAI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PesquisasPage() {
  return <PesquisasClient />;
}
