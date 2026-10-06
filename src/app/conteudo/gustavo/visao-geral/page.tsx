import { GustavoOverview } from "@/components/gustavo-content/gustavo-overview";
import { requireGustavoContentAccess } from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export default async function GustavoOverviewPage() {
  const actor = await requireGustavoContentAccess();
  return <GustavoOverview isOwner={actor.memberRole === "owner"} />;
}
