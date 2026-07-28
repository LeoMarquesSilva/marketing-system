import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  ProfileHttpError,
  getProfileCampaign,
  saveProfileCampaign,
  toProfileApiError,
} from "@/lib/profiles/admin";
import { profileCampaignUpdateSchema } from "@/lib/profiles/validation";
import { isProfileCampaignActive } from "@/lib/profiles/campaign";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireProfessionalProfileAdmin();
    const campaign = await getProfileCampaign();
    return NextResponse.json({
      campaign,
      isActive: isProfileCampaignActive(campaign, new Date()),
    });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireProfessionalProfileAdmin();

    const body = await request.json().catch(() => null);
    const parsed = profileCampaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProfileHttpError(
        parsed.error.issues[0]?.message ?? "Campanha inválida.",
        400,
        "PROFILE_INVALID"
      );
    }

    const campaign = {
      enabled: parsed.data.enabled,
      startsAt: parsed.data.startsAt ?? null,
      endsAt: parsed.data.endsAt ?? null,
      titlePt: parsed.data.titlePt,
      titleEn: parsed.data.titleEn,
      messagePt: parsed.data.messagePt,
      messageEn: parsed.data.messageEn,
      callToActionPt: parsed.data.callToActionPt ?? null,
      callToActionEn: parsed.data.callToActionEn ?? null,
    };

    await saveProfileCampaign(campaign, admin.userId);
    return NextResponse.json({
      campaign,
      isActive: isProfileCampaignActive(campaign, new Date()),
    });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
