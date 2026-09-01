import { GustavoContentError } from "@/lib/gustavo-content/errors";
import { getGustavoContentAdmin } from "@/lib/gustavo-content/server";
import {
  validateStrategyInput,
  type GustavoStrategy,
  type GustavoStrategyInput,
} from "@/lib/gustavo-content/strategy";

const STRATEGY_SELECT =
  "id, positioning, editorial_promise, strategic_rationale, icp, icp_context, content_pillars, channel_roles, editorial_principles, avoidances, success_signals, updated_by, created_at, updated_at";

export async function getStrategy(): Promise<GustavoStrategy> {
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_strategy")
    .select(STRATEGY_SELECT)
    .eq("id", "main")
    .maybeSingle();
  if (error) throw new GustavoContentError(error.message, 500);
  if (!data) throw new GustavoContentError("Estratégia de posicionamento não encontrada.", 404);
  return data as GustavoStrategy;
}

export async function updateStrategy(
  input: GustavoStrategyInput,
  actorId: string
): Promise<GustavoStrategy> {
  const parsed = validateStrategyInput(input);
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_strategy")
    .update({ ...parsed, updated_by: actorId })
    .eq("id", "main")
    .select(STRATEGY_SELECT)
    .maybeSingle();
  if (error) throw new GustavoContentError(error.message, 500);
  if (!data) throw new GustavoContentError("Estratégia de posicionamento não encontrada.", 404);
  return data as GustavoStrategy;
}
