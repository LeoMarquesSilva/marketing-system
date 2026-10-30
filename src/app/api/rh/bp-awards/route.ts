import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getCommitteeView, updateEdition } from "@/lib/rh/bp-awards/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCommitteeView(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Datas da votação, sócios concorrendo e publicação do resultado. */
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ edition: await updateEdition(body) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
