import type { Metadata } from "next";
import { RevealClient } from "@/components/rh/bp-awards/reveal/reveal-client";
import { getRevealData } from "@/lib/rh/bp-awards/server";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BP Awards · Revelação",
  robots: { index: false, follow: false },
};

async function loadReveal() {
  try {
    return await getRevealData();
  } catch (error) {
    if (error instanceof RhHttpError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}

/** Telão da festa (só RH): valor → finalistas → vencedor, avançando pelo teclado ou passador. */
export default async function BpAwardsRevealPage() {
  const data = await loadReveal();
  return <RevealClient data={data} />;
}
