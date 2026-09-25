import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { getFaceStatus, grantFaceConsent, revokeFaceConsent } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    return NextResponse.json({ status: await getFaceStatus(actor) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao consultar reconhecimento facial.");
    return NextResponse.json({ error }, { status });
  }
}

/** Opt-in: body `{ consentVersion, references: [{ sourcePhotoId, descriptor }] }`. */
export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ status: await grantFaceConsent(actor, body) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao ativar reconhecimento facial.");
    return NextResponse.json({ error }, { status });
  }
}

/** Revoga e apaga referências, correspondências e varreduras. */
export async function DELETE() {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    return NextResponse.json({ status: await revokeFaceConsent(actor) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao desativar reconhecimento facial.");
    return NextResponse.json({ error }, { status });
  }
}
