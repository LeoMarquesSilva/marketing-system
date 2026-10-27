import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { feedzMessage } from "@/lib/rh/boas-praticas/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await feedzMessage(id));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
