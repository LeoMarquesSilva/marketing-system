import "server-only";

import { NextResponse } from "next/server";
import { OpsPlannerHttpError, requireOpsActor, toOpsApiError, type OpsActor } from "./server";

/** Rota do Planner: valida o usuário, roda a ação e converte o erro tipado em status HTTP. */
export async function withOpsActor<T>(action: (actor: OpsActor) => Promise<T>): Promise<NextResponse> {
  try {
    const actor = await requireOpsActor();
    return NextResponse.json(await action(actor));
  } catch (error) {
    const apiError = toOpsApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new OpsPlannerHttpError("Corpo da requisição inválido.", 400, "INVALID_JSON");
  }
}
