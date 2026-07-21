import { NextResponse } from "next/server";
import { listNfcTemplates, toApiError } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ templates: await listNfcTemplates() });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

