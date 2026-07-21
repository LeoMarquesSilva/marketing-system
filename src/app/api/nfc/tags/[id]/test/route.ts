import { NextResponse } from "next/server";
import { getNfcPublicUrl, getNfcTag, toApiError } from "@/lib/nfc/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { tag } = await getNfcTag(id);
    return NextResponse.json({ url: getNfcPublicUrl(tag.public_token, new URL(request.url).origin) });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

