import { NextResponse } from "next/server";
import { duplicateNfcTag, toApiError } from "@/lib/nfc/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ tag: await duplicateNfcTag(id) }, { status: 201 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

