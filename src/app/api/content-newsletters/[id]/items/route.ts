import { NextResponse } from "next/server";
import {
  addItemFromLink,
  addItemsFromRoteiros,
  fetchNewsletter,
  NewsletterError,
  reorderItems,
} from "@/lib/content-newsletter";
import {
  newsletterErrorResponse,
  requireNewsletterAccess,
  requireNewsletterForUser,
} from "@/lib/content-newsletter-access";

export const dynamic = "force-dynamic";
// Redigir várias seções com IA (mais scraping) é lento.
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireNewsletterAccess();
    const { id } = await context.params;
    await requireNewsletterForUser(id, access);

    const body = (await request.json().catch(() => ({}))) as {
      roteiro_ids?: string[];
      url?: string;
    };

    if (body.url) {
      const item = await addItemFromLink(id, body.url);
      return NextResponse.json({ created: [item], errors: [] }, { status: 201 });
    }

    const roteiroIds = (body.roteiro_ids ?? []).filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
    if (roteiroIds.length === 0) {
      throw new NewsletterError("Selecione ao menos uma notícia.", 400);
    }

    const result = await addItemsFromRoteiros(id, roteiroIds);
    return NextResponse.json(result, { status: result.created.length > 0 ? 201 : 200 });
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireNewsletterAccess();
    const { id } = await context.params;
    await requireNewsletterForUser(id, access);

    const body = (await request.json().catch(() => ({}))) as { ordered_ids?: string[] };
    const orderedIds = (body.ordered_ids ?? []).filter(
      (value): value is string => typeof value === "string"
    );
    if (orderedIds.length === 0) {
      throw new NewsletterError("Informe a nova ordem das seções.", 400);
    }

    await reorderItems(id, orderedIds);
    return NextResponse.json(await fetchNewsletter(id));
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}
