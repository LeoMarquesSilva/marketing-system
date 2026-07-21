import { NextResponse } from "next/server";
import { listNfcLogs, toApiError } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ logs: await listNfcLogs() });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

