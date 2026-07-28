import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { ProfileHttpError, setContentOverride, toProfileApiError } from "@/lib/profiles/admin";
import { profileContentOverrideSchema } from "@/lib/profiles/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireProfessionalProfileAdmin();
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = profileContentOverrideSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProfileHttpError("Conteúdo inválido.", 400, "PROFILE_INVALID");
    }

    // Só a tabela de override muda — a publicação original nunca é tocada.
    await setContentOverride(id, parsed.data.sourceType, parsed.data.sourceId, parsed.data.hidden);
    return NextResponse.json({ success: true });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
