import {
  buildNewsletterWordHtml,
  newsletterWordSlug,
} from "@/lib/content-newsletter-word";
import {
  requireNewsletterAccess,
  requireNewsletterForUser,
} from "@/lib/content-newsletter-access";
import { NewsletterError } from "@/lib/content-newsletter";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireNewsletterAccess();
    const { id } = await context.params;
    const newsletter = await requireNewsletterForUser(id, access);

    const html = buildNewsletterWordHtml(newsletter, newsletter.items);

    return new Response("\uFEFF" + html, {
      status: 200,
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="newsletter-${newsletterWordSlug(
          newsletter.title
        )}.doc"`,
      },
    });
  } catch (err) {
    const status = err instanceof NewsletterError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao gerar o documento.";
    return new Response(message, { status });
  }
}
