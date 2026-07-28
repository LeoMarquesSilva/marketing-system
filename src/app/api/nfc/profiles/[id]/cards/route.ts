import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { ProfileHttpError, toProfileApiError } from "@/lib/profiles/admin";
import { createProfileCard, listProfileCards } from "@/lib/profiles/cards";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().trim().min(1).max(120),
  nfcTagId: z.string().uuid().nullable().optional(),
  replaceCardId: z.string().uuid().nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireProfessionalProfileAdmin();
    const { id } = await context.params;
    return NextResponse.json({ cards: await listProfileCards(id) });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireProfessionalProfileAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProfileHttpError("Dados do cartão inválidos.", 400, "PROFILE_CARD_INVALID");
    }
    const card = await createProfileCard(id, parsed.data, admin.userId);
    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
