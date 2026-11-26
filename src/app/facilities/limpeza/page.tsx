import { FacilitiesAcessoNegado } from "@/components/facilities/facilities-access-denied";
import { LimpezaAcompanhamentoClient } from "@/components/facilities/limpeza-acompanhamento-client";
import { cleaningGuideSeen, getCleaningMonth, type CleaningMonthView } from "@/lib/facilities/cleaning-server";
import { FacilitiesHttpError } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

async function load(month?: string): Promise<{ view: CleaningMonthView; guideSeen: boolean } | null> {
  try {
    const [view, guideSeen] = await Promise.all([getCleaningMonth(month), cleaningGuideSeen("limpeza-acompanhamento")]);
    return { view, guideSeen };
  } catch (error) {
    if (error instanceof FacilitiesHttpError && error.status === 403) return null;
    throw error;
  }
}

/** Facilities > Limpeza: conferir e assinar os dias, anotações e números. */
export default async function LimpezaAcompanhamentoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const data = await load((await searchParams).mes);
  if (!data) return <FacilitiesAcessoNegado />;
  return <LimpezaAcompanhamentoClient initialView={data.view} guideSeen={data.guideSeen} />;
}
