import { NextResponse } from "next/server";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireGustavoContentAccess();
    return NextResponse.json({
      allowed: true,
      isAdmin: actor.isAdmin,
      memberRole: actor.memberRole,
      userId: actor.id,
    });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
