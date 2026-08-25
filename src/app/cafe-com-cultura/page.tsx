import type { Metadata } from "next";
import { CafeCheckinClient } from "@/components/cafe-cultura/cafe-checkin-client";

export const metadata: Metadata = {
  title: "Café com Cultura — Confirmar presença",
  description: "Check-in institucional do Café com Cultura.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CafeComCulturaPage() {
  return <CafeCheckinClient />;
}
