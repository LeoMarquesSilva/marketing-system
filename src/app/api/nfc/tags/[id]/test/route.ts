import { NextResponse } from "next/server";
import { getNfcPublicUrl, getNfcTag, toApiError } from "@/lib/nfc/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { tag } = await getNfcTag(id);
    return NextResponse.json({ url: getNfcPublicUrl(tag.public_token) });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
