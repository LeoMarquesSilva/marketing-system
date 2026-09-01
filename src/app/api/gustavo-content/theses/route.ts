import { NextResponse } from "next/server";
import { createThesis, listTheses } from "@/lib/gustavo-content/theses-server";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGustavoContentAccess();
    const theses = await listTheses();
    return NextResponse.json(theses);
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    const body = await request.json().catch(() => ({}));
    const thesis = await createThesis(body, actor.id);
    return NextResponse.json(thesis, { status: 201 });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
