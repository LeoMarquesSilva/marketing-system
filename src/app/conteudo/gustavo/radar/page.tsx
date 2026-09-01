import { RadarBoard } from "@/components/gustavo-content/radar-board";
import { requireGustavoContentAccess } from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export default async function GustavoRadarPage() {
  const actor = await requireGustavoContentAccess();
  return <RadarBoard isAdmin={actor.isAdmin} />;
}
