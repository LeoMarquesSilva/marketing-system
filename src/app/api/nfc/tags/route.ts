import { NextResponse } from "next/server";
import { createNfcTag, listNfcTags, toApiError } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ tags: await listNfcTags() });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    return NextResponse.json({ tag: await createNfcTag(input) }, { status: 201 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

