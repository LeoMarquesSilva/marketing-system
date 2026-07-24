import { NextResponse } from "next/server";
import { toApiError, updateNfcAsset } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const [{ id }, input] = await Promise.all([context.params, request.json()]);
    await updateNfcAsset(id, input);
    return NextResponse.json({ success: true });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
