import { NextResponse } from "next/server";
import { createTopic, listTopics } from "@/lib/gustavo-content/topics";
import {
  GustavoContentError,
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGustavoContentAccess();
    return NextResponse.json(await listTopics());
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    if (!actor.isAdmin) {
      throw new GustavoContentError("Somente admin configura os temas RSS.", 403);
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(await createTopic(body), { status: 201 });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
