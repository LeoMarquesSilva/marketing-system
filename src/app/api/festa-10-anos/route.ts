import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { FESTA_10_ANOS_EVENT_ID, parseRsvpAnswer } from "@/lib/event-rsvp";
import { getRsvpPending, getRsvpView, saveRsvp } from "@/lib/event-rsvp-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Confirmação da festa de 10 anos de quem está logado. `?convite=1`: só diz se falta responder (aviso ao entrar). */
export async function GET(request: Request) {
  try {
    const invite = new URL(request.url).searchParams.get("convite") === "1";
    const body = invite ? await getRsvpPending(FESTA_10_ANOS_EVENT_ID) : await getRsvpView(FESTA_10_ANOS_EVENT_ID);
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Grava "vou / não vou" e o uso do micro-ônibus. */
export async function POST(request: Request) {
  try {
    const answer = parseRsvpAnswer(await request.json().catch(() => null));
    if (!answer) {
      return NextResponse.json(
        { error: "Diga se você vai e, se for, como vai usar o micro-ônibus.", code: "INVALID" },
        { status: 400 }
      );
    }
    return NextResponse.json(await saveRsvp(FESTA_10_ANOS_EVENT_ID, answer), { headers: NO_STORE });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
