import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { toProfileApiError } from "@/lib/profiles/admin";
import { getProfileCardQrPayload } from "@/lib/profiles/cards";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  try {
    await requireProfessionalProfileAdmin();
    const { cardId } = await context.params;
    const { url, png } = await getProfileCardQrPayload(cardId);

    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("application/json")) {
      return NextResponse.json({
        url,
        pngBase64: png.toString("base64"),
      });
    }

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="perfil-card-${cardId}.png"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
