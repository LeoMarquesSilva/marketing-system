import { NextResponse } from "next/server";
import { createItemFromIdea } from "@/lib/gustavo-content/items";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    const body = (await request.json().catch(() => ({}))) as { idea?: string };
    const item = await createItemFromIdea(String(body.idea ?? ""), {
      id: actor.id,
      name: actor.name,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
