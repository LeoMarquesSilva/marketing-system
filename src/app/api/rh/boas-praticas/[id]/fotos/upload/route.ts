import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createPhotoUpload } from "@/lib/rh/boas-praticas/server";

export const dynamic = "force-dynamic";

/** URL assinada para subir a foto direto no bucket privado. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await createPhotoUpload(id, await request.json()));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
