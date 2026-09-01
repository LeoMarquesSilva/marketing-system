import { NextResponse } from "next/server";
import {
  analyzeItem,
  approveItem,
  generateItemContent,
  getItem,
  markPublished,
  rejectItem,
  saveItemAnswers,
  saveItemEdits,
  selectAngle,
  sendItemToPlanner,
  submitToGustavo,
} from "@/lib/gustavo-content/items";
import {
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireGustavoContentAccess();
    const { id } = await context.params;
    return NextResponse.json(await getItem(id));
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireGustavoContentAccess();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "analyze") return NextResponse.json(await analyzeItem(id));
    if (action === "generate") return NextResponse.json(await generateItemContent(id));
    if (action === "select_angle") {
      return NextResponse.json(await selectAngle(id, Number(body.angleIndex ?? 0)));
    }
    if (action === "answer") {
      const answers = Array.isArray(body.answers) ? body.answers.map((item) => String(item)) : [];
      return NextResponse.json(await saveItemAnswers(id, answers, actor));
    }
    if (action === "save") {
      return NextResponse.json(
        await saveItemEdits(
          id,
          {
            linkedin_post: typeof body.linkedin_post === "string" ? body.linkedin_post : undefined,
            reel_script: typeof body.reel_script === "string" ? body.reel_script : undefined,
          },
          actor
        )
      );
    }
    if (action === "submit") return NextResponse.json(await submitToGustavo(id));
    if (action === "approve") return NextResponse.json(await approveItem(id, actor));
    if (action === "reject") {
      return NextResponse.json(
        await rejectItem(id, typeof body.reason === "string" ? body.reason : null)
      );
    }
    if (action === "publish") {
      return NextResponse.json(
        await markPublished(id, {
          linkedin_published_url:
            typeof body.linkedin_published_url === "string" ? body.linkedin_published_url : undefined,
          instagram_published_url:
            typeof body.instagram_published_url === "string"
              ? body.instagram_published_url
              : undefined,
        })
      );
    }
    if (action === "planner_linkedin") {
      return NextResponse.json(await sendItemToPlanner(id, "linkedin", actor));
    }
    if (action === "planner_reel") {
      return NextResponse.json(await sendItemToPlanner(id, "reel", actor));
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
