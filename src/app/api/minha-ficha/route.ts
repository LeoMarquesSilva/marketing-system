import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { RegistrationValidationError } from "@/lib/rh/registration/server";
import { getSelfRegistration, submitSelfRegistration } from "@/lib/rh/registration/self-service";

export const dynamic = "force-dynamic";

/** Ficha cadastral do colaborador logado (pré-preenchida com o que o escritório já tem). */
export async function GET() {
  try {
    const result = await getSelfRegistration();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Envia a atualização para a revisão de Pessoas e Cultura. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    await submitSelfRegistration(body, request);
    return NextResponse.json({ success: true });
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
