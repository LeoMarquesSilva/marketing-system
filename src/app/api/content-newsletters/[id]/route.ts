import { NextResponse } from "next/server";
import {
  deleteNewsletter,
  fetchNewsletter,
  generateNewsletterIntro,
  signNewsletter,
  updateNewsletter,
  type NewsletterUpdate,
} from "@/lib/content-newsletter";
import {
  newsletterErrorResponse,
  requireNewsletterAccess,
  requireNewsletterForUser,
} from "@/lib/content-newsletter-access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireNewsletterAccess();
    const { id } = await context.params;
    const newsletter = await requireNewsletterForUser(id, access);
    return NextResponse.json(newsletter);
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
    const newsletter = await requireNewsletterForUser(id, access);

    const body = (await request.json().catch(() => ({}))) as NewsletterUpdate & {
      action?: string;
    };

    if (body.action === "sign") {
      await signNewsletter(id, access.actor);
      return NextResponse.json(await fetchNewsletter(id));
    }

    if (body.action === "reopen") {
      await updateNewsletter(id, { status: "em_revisao" });
      return NextResponse.json(await fetchNewsletter(id));
    }

    if (body.action === "generate_intro") {
      const intro = await generateNewsletterIntro(
        newsletter.area,
        newsletter.items.map((item) => item.headline)
      );
      await updateNewsletter(id, {
        intro_title: intro.headline,
        intro_body: intro.body,
      });
      return NextResponse.json(await fetchNewsletter(id));
    }

    // Campos de texto apenas: o status muda só pelas ações acima, para não
    // marcar uma edição como assinada sem gravar quem assinou.
    await updateNewsletter(id, {
      title: body.title,
      edition_label: body.edition_label,
      intro_title: body.intro_title,
      intro_body: body.intro_body,
      signature_names: body.signature_names,
      collaborator_names: body.collaborator_names,
    });
    return NextResponse.json(await fetchNewsletter(id));
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireNewsletterAccess();
    const { id } = await context.params;
    await requireNewsletterForUser(id, access);
    await deleteNewsletter(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return newsletterErrorResponse(err);
  }
}
