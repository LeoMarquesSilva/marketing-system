import { FacilitiesAcessoNegado } from "@/components/facilities/facilities-access-denied";
import { LimpezaCronogramaClient } from "@/components/facilities/limpeza-cronograma-client";
import { cleaningGuideSeen, getCleaningSchedule, type CleaningScheduleView } from "@/lib/facilities/cleaning-server";
import { FacilitiesHttpError } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

async function load(): Promise<{ schedule: CleaningScheduleView; guideSeen: boolean } | null> {
  try {
    const [schedule, guideSeen] = await Promise.all([getCleaningSchedule(), cleaningGuideSeen("limpeza-cronograma")]);
    return { schedule, guideSeen };
  } catch (error) {
    if (error instanceof FacilitiesHttpError && error.status === 403) return null;
    throw error;
  }
}

/** Facilities > Limpeza > Cronograma: as 4 semanas da planilha, editáveis. */
export default async function LimpezaCronogramaPage() {
  const data = await load();
  if (!data) return <FacilitiesAcessoNegado />;
  return <LimpezaCronogramaClient initialSchedule={data.schedule} guideSeen={data.guideSeen} />;
}
