import { NextResponse } from "next/server";
import {
  createVoiceSample,
  listVoiceSamples,
} from "@/lib/gustavo-content/voice-server";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGustavoContentAccess();
    const samples = await listVoiceSamples();
    return NextResponse.json(samples);
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    const body = await request.json().catch(() => ({}));
    const sample = await createVoiceSample(body, actor.id);
    return NextResponse.json(sample, { status: 201 });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
