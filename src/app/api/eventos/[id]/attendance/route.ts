import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireCafeCulturaAccess } from "@/lib/api-auth";
import {
  CafeCulturaError,
  getCafeAdminData,
  getCafeProfileForAuthUser,
  updateCafeEventSettings,
  updateCafeParticipant,
} from "@/lib/cafe-cultura/server";
import type { CafeExpectationStatus } from "@/lib/cafe-cultura/types";

type Context = { params: Promise<{ id: string }> };
const EXPECTATION = new Set<CafeExpectationStatus>(["confirmed", "excused_absence", "excluded"]);

function responseForError(error: unknown) {
  if (error instanceof CafeCulturaError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (/não autenticado/i.test(message)) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (/administrador|café com cultura/i.test(message)) {
    return NextResponse.json({ error: message || "Sem permissão para o Café com Cultura." }, { status: 403 });
  }
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}
async function requireAttendanceAdmin() {
  const authUser = await requireAuthenticatedUser();
  await requireCafeCulturaAccess(authUser.id);
  return getCafeProfileForAuthUser(authUser.id);
}

export async function GET(_request: Request, context: Context) {
  try {
    await requireAttendanceAdmin();
    const { id } = await context.params;
    return NextResponse.json({ data: await getCafeAdminData(id) });
  } catch (error) {
    return responseForError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const adminProfile = await requireAttendanceAdmin();
    const { id } = await context.params;
    const body = await request.json();
    if (body?.participant) {
      const participant = body.participant as Record<string, unknown>;
      const userId = typeof participant.userId === "string" ? participant.userId : "";
      const expectationStatus = EXPECTATION.has(participant.expectationStatus as CafeExpectationStatus)
        ? (participant.expectationStatus as CafeExpectationStatus)
        : undefined;
      const present = typeof participant.present === "boolean" ? participant.present : undefined;
      if (!userId) return NextResponse.json({ error: "Colaborador inválido." }, { status: 400 });
      const data = await updateCafeParticipant(id, userId, { expectationStatus, present }, adminProfile.id);
      return NextResponse.json({ data });
    }
    const settings = (body?.settings ?? {}) as Record<string, unknown>;
    const data = await updateCafeEventSettings(
      id,
      {
        name: typeof settings.name === "string" ? settings.name : undefined,
        eventDate: typeof settings.eventDate === "string" ? settings.eventDate : undefined,
        location: settings.location === null || typeof settings.location === "string" ? settings.location : undefined,
        attendanceCutoffAt:
          settings.attendanceCutoffAt === null || typeof settings.attendanceCutoffAt === "string"
            ? settings.attendanceCutoffAt
            : undefined,
        checkinOpensAt: typeof settings.checkinOpensAt === "string" ? settings.checkinOpensAt : undefined,
        checkinClosesAt: typeof settings.checkinClosesAt === "string" ? settings.checkinClosesAt : undefined,
      },
      adminProfile.id
    );
    return NextResponse.json({ data });
  } catch (error) {
    return responseForError(error);
  }
}
