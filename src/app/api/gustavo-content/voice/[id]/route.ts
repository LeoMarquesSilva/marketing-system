import { NextResponse } from "next/server";
import { deleteVoiceSample, updateVoiceSample } from "@/lib/gustavo-content/voice-server";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireGustavoContentAccess();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const sample = await updateVoiceSample(id, body);
    return NextResponse.json(sample);
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireGustavoContentAccess();
    const { id } = await context.params;
    await deleteVoiceSample(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
