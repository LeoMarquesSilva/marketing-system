import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createType, setTypeActive } from "@/lib/rh/pdi/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name: string; description?: string | null };
    return NextResponse.json({ type: await createType(body) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id: string; is_active: boolean };
    await setTypeActive(body.id, Boolean(body.is_active));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
