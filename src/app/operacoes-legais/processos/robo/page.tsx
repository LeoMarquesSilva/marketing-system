import type { Metadata } from "next";
import { RoboClient } from "@/components/operacoes-legais/processos/robo-client";

export const metadata: Metadata = {
  title: "Processos — Robô de autos — ORQESTRAI",
  description: "Gestão do robô de autos: a fila e a previsão de término, o que já foi baixado, o que a IA leu e o que ainda não rodou.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProcessosRoboPage() {
  return <RoboClient />;
}
