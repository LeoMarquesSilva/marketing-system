import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  ProfileHttpError,
  createProfileAdminClient,
  toProfileApiError,
} from "@/lib/profiles/admin";
import {
  createProfileCard,
  setProfileCardPhysicalStatus,
  setProfileCardStatus,
} from "@/lib/profiles/cards";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    status: z.enum(["active", "inactive"]),
  }),
  z.object({
    action: z.literal("replace"),
    label: z.string().trim().min(1).max(120),
    nfcTagId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("physical"),
    done: z.boolean(),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  try {
    const admin = await requireProfessionalProfileAdmin();
    const { cardId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProfileHttpError("Dados inválidos.", 400, "PROFILE_CARD_INVALID");
    }

    if (parsed.data.action === "status") {
      await setProfileCardStatus(cardId, parsed.data.status, admin.userId);
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "physical") {
      const card = await setProfileCardPhysicalStatus(cardId, parsed.data.done);
      return NextResponse.json({ card });
    }

    const db = createProfileAdminClient();
    const { data: current } = await db
      .from("professional_profile_cards")
      .select("profile_id")
      .eq("id", cardId)
      .maybeSingle();
    if (!current) {
      throw new ProfileHttpError("Cartão não encontrado.", 404, "PROFILE_CARD_NOT_FOUND");
    }

    const card = await createProfileCard(
      current.profile_id as string,
      {
        label: parsed.data.label,
        nfcTagId: parsed.data.nfcTagId,
        replaceCardId: cardId,
      },
      admin.userId
    );
    return NextResponse.json({ card });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
