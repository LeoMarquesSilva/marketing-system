import { NextResponse } from "next/server";
import {
  deleteItem,
  NewsletterError,
  regenerateItem,
  updateItemText,
} from "@/lib/content-newsletter";
import {
  newsletterErrorResponse,
  requireNewsletterAccess,
  requireNewsletterForUser,
} from "@/lib/content-newsletter-access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const access = await requireNewsletterAccess();
    const { id, itemId } = await context.params;
    await requireNewsletterForUser(id, access);

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      headline?: string;
      body?: string;
      instructions?: string;
    };

    if (body.action === "regenerate") {
      const item = await regenerateItem(id, itemId, body.instructions ?? null);
      return NextResponse.json(item);
    }

    if (body.headline === undefined && body.body === undefined) {
      throw new NewsletterError("Nada para atualizar.", 400);
    }
    if (body.body !== undefined && !body.body.trim()) {
      throw new NewsletterError("O texto da seção não pode ficar vazio.", 400);
    }
    if (body.headline !== undefined && !body.headline.trim()) {
      throw new NewsletterError("O título da seção não pode ficar vazio.", 400);
    }

    await updateItemText(
      id,
      itemId,
      { headline: body.headline, body: body.body },
      access.actor
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const access = await requireNewsletterAccess();
    const { id, itemId } = await context.params;
    await requireNewsletterForUser(id, access);
    await deleteItem(id, itemId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}
