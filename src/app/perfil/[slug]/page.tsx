import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ProfessionalProfilePage } from "@/components/profiles/professional-profile-page";
import { resolveProfileLocale } from "@/lib/profiles/localization";
import { getPublicProfessionalProfile } from "@/lib/profiles/public";
import { isAllowedProfileSource } from "@/components/profiles/profile-public-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string; source?: string }>;
};

function langQuery(locale: string, requested: string | undefined): string {
  const raw = (requested ?? "").trim();
  if (!raw) return "";
  return `?lang=${encodeURIComponent(locale === "en" ? "en" : raw)}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const locale = resolveProfileLocale(query.lang);
  const result = await getPublicProfessionalProfile(slug, locale);

  if (!result) {
    notFound();
  }

  if (result.kind === "redirect") {
    return {
      title: "Perfil — Bismarchi | Pires",
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
    };
  }

  const { identity } = result.profile;
  const description =
    identity.tagline || identity.bio || `${identity.name} — ${identity.role}`;

  return {
    title: `${identity.name} — ${identity.role} | Bismarchi | Pires`,
    description,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    openGraph: {
      title: identity.name,
      description,
      images: identity.photoUrl ? [{ url: identity.photoUrl }] : undefined,
    },
  };
}

export default async function PublicProfessionalProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const locale = resolveProfileLocale(query.lang);
  const result = await getPublicProfessionalProfile(slug, locale);

  if (!result) {
    notFound();
  }

  if (result.kind === "redirect") {
    permanentRedirect(`/perfil/${result.slug}${langQuery(locale, query.lang)}`);
  }

  const source = isAllowedProfileSource(query.source) ? query.source : null;

  return <ProfessionalProfilePage profile={result.profile} source={source} />;
}
