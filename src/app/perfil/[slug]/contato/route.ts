import { resolveProfileLocale } from "@/lib/profiles/localization";
import {
  getPublicProfessionalProfile,
  recordContactDownloadEvent,
} from "@/lib/profiles/public";
import { buildVCard, makeVCardFilename } from "@/lib/profiles/vcard";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const locale = resolveProfileLocale(url.searchParams.get("lang"));

  const result = await getPublicProfessionalProfile(slug, locale);

  if (!result || result.kind === "redirect") {
    return new Response("Perfil não encontrado.", { status: 404 });
  }

  const { profile } = result;
  const filename = makeVCardFilename(profile.identity.name);
  const vcard = buildVCard({
    displayName: profile.identity.name,
    role: profile.identity.role,
    email: profile.contacts.email,
    phone: profile.contacts.whatsapp,
    linkedinUrl: profile.contacts.linkedinUrl,
    websiteUrl: profile.contacts.websiteUrl,
  });

  void recordContactDownloadEvent(profile.id, locale);

  return new Response(vcard, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
