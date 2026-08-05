import { NextResponse } from "next/server";
import { LEGAL_AREAS } from "@/lib/content-areas";
import { createNewsletter, listNewsletters, NewsletterError } from "@/lib/content-newsletter";
import {
  newsletterErrorResponse,
  requireNewsletterAccess,
} from "@/lib/content-newsletter-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await requireNewsletterAccess();
    const { searchParams } = new URL(request.url);
    const area = searchParams.get("area") ?? undefined;

    if (area && access.allowedAreas && !access.allowedAreas.includes(area)) {
      throw new NewsletterError("Sem permissão para esta área.", 403);
    }

    const newsletters = await listNewsletters({
      area,
      areas: area ? undefined : (access.allowedAreas ?? undefined),
    });
    return NextResponse.json(newsletters);
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireNewsletterAccess();
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      area?: string;
      edition_label?: string;
    };

    const area = body.area ?? access.allowedAreas?.[0] ?? "Reestruturação";
    if (!LEGAL_AREAS.includes(area as (typeof LEGAL_AREAS)[number])) {
      throw new NewsletterError("Área inválida.", 400);
    }
    if (access.allowedAreas && !access.allowedAreas.includes(area)) {
      throw new NewsletterError("Sem permissão para esta área.", 403);
    }
    if (!body.title?.trim()) {
      throw new NewsletterError("Informe um título para a edição.", 400);
    }

    const newsletter = await createNewsletter(
      { title: body.title, area, edition_label: body.edition_label ?? null },
      access.actor
    );
    return NextResponse.json(newsletter, { status: 201 });
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}
