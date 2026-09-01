import { NextResponse } from "next/server";
import { createItemFromLink } from "@/lib/gustavo-content/items";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const item = await createItemFromLink(String(body.url ?? ""), {
      id: actor.id,
      name: actor.name,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
