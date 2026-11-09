import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { resetParticipant, saveParticipant } from "@/lib/rh/bp-awards/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ employeeId: string }> };

/** Exceção da pessoa: hub, onde vota e se concorre. */
export async function PUT(request: Request, { params }: Context) {
  try {
    const { employeeId } = await params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ override: await saveParticipant(employeeId, body) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Volta a pessoa para a regra da área. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { employeeId } = await params;
    await resetParticipant(employeeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
