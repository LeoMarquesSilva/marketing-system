import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getRsvpPanel } from "@/lib/event-rsvp-server";

export const dynamic = "force-dynamic";

/** Respostas da equipe à confirmação de presença (painel na aba Convidados). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await getRsvpPanel(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
