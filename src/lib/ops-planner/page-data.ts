import "server-only";

import { OpsPlannerHttpError, getPlannerContext, requireOpsActor, type OpsActor } from "./server";
import type { OpsPlannerContext } from "./types";

export type PlannerPageData<T> = { forbidden: true; message?: string } | ({ forbidden: false; context: OpsPlannerContext } & T);

/** Carrega o contexto do Planner e os dados da página; 401/403/404 viram a tela de acesso restrito. */
export async function loadPlannerPage<T>(load: (actor: OpsActor, context: OpsPlannerContext) => Promise<T>): Promise<PlannerPageData<T>> {
  try {
    const actor = await requireOpsActor();
    const context = await getPlannerContext(actor);
    return { forbidden: false, context, ...(await load(actor, context)) };
  } catch (error) {
    if (error instanceof OpsPlannerHttpError && [401, 403, 404].includes(error.status)) {
      return { forbidden: true, message: error.status === 404 ? error.message : undefined };
    }
    throw error;
  }
}
