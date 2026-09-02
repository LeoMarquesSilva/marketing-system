import { StrategyBoard } from "@/components/gustavo-content/strategy-board";
import { canPerformGustavoContentAction } from "@/lib/gustavo-content/access";
import { requireGustavoContentAccess } from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export default async function GustavoStrategyPage() {
  const actor = await requireGustavoContentAccess();
  return (
    <StrategyBoard canEdit={canPerformGustavoContentAction(actor, "edit_strategy")} />
  );
}
