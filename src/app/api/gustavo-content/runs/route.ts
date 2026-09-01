import { NextResponse } from "next/server";
import { listFetchRuns } from "@/lib/gustavo-content/pipeline";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGustavoContentAccess();
    return NextResponse.json(await listFetchRuns());
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
