import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  ProfileHttpError,
  getProfessionalProfileAdmin,
  saveProfessionalProfile,
  toProfileApiError,
} from "@/lib/profiles/admin";
import { profileUpdateSchema } from "@/lib/profiles/validation";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireProfessionalProfileAdmin();
    const { id } = await context.params;
    return NextResponse.json({ profile: await getProfessionalProfileAdmin(id) });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireProfessionalProfileAdmin();
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProfileHttpError(
        parsed.error.issues[0]?.message ?? "Dados do perfil inválidos.",
        400,
        "PROFILE_INVALID"
      );
    }

    const profile = await saveProfessionalProfile(id, parsed.data, admin.userId);
    return NextResponse.json({ profile });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
