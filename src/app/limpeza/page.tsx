import { LimpezaHojeClient } from "@/components/facilities/limpeza-hoje-client";
import { cleaningGuideSeen, getCleaningDay, type CleaningDayView } from "@/lib/facilities/cleaning-server";
import { FacilitiesHttpError } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

async function load(): Promise<{ view: CleaningDayView; guideSeen: boolean } | null> {
  try {
    const [view, guideSeen] = await Promise.all([getCleaningDay(), cleaningGuideSeen("limpeza-hoje")]);
    return { view, guideSeen };
  } catch (error) {
    if (error instanceof FacilitiesHttpError && error.status === 403) return null;
    throw error;
  }
}

/** Limpeza de hoje: a equipe da limpeza marca no celular os ambientes do dia. */
export default async function LimpezaHojePage() {
  const data = await load();
  if (!data) {
    return (
      <div className="mx-auto max-w-md rounded-xl bg-white px-6 py-10 text-center ring-1 ring-[#dce9eb]">
        <p className="text-lg font-semibold text-foreground">Esta tela é da equipe da limpeza</p>
        <p className="mt-1 text-sm text-muted-foreground">Peça a Facilities para liberar &quot;Limpeza de hoje&quot; em Usuários.</p>
      </div>
    );
  }
  return <LimpezaHojeClient initialView={data.view} guideSeen={data.guideSeen} />;
}
