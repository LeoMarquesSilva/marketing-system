import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  ProfileHttpError,
  setProfessionalProfileStatus,
  toProfileApiError,
} from "@/lib/profiles/admin";
import { profileStatusUpdateSchema } from "@/lib/profiles/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireProfessionalProfileAdmin();
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = profileStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProfileHttpError("Status inválido.", 400, "PROFILE_INVALID");
    }

    // Publicar valida o checklist no repositório e falha com PROFILE_INCOMPLETE.
    await setProfessionalProfileStatus(id, parsed.data.status, admin.userId);
    return NextResponse.json({ success: true, status: parsed.data.status });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
