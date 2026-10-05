import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import {
  getRegistrationForm,
  RegistrationValidationError,
  runRegistrationAction,
  type RegistrationAction,
} from "@/lib/rh/registration/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const form = await getRegistrationForm(id);
    return NextResponse.json({ form }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Ações da RH: salvar correção, aprovar, devolver, cancelar, novo link, vincular. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as RegistrationAction;
    const form = await runRegistrationAction(id, body);
    return NextResponse.json({ form });
  } catch (error) {
    if (error instanceof RegistrationValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code, fieldErrors: error.fieldErrors },
        { status: error.status }
      );
    }
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
