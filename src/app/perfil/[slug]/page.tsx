import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { resolveProfileLocale } from "@/lib/profiles/localization";
import { getPublicProfessionalProfile } from "@/lib/profiles/public";
import { PROFILE_SECTION_LABELS } from "@/lib/profiles/types";
import type { PublicProfessionalProfile } from "@/lib/profiles/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
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

  if (!result || result.kind !== "profile") {
    notFound();
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

function MinimalPublicProfile({ profile }: { profile: PublicProfessionalProfile }) {
  const { identity, contacts, sections, recentContent, campaignMessage } = profile;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem" }}>
      {campaignMessage ? <p role="status">{campaignMessage}</p> : null}

      <header>
        <h1>{identity.name}</h1>
        <p>{identity.role}</p>
        {identity.practiceArea ? <p>{identity.practiceArea}</p> : null}
        {identity.oab ? <p>{identity.oab}</p> : null}
        {identity.tenureLabel ? <p>{identity.tenureLabel}</p> : null}
        {identity.tagline ? <p>{identity.tagline}</p> : null}
        {identity.bio ? <p>{identity.bio}</p> : null}
      </header>

      <section aria-label="Contatos">
        <ul>
          {contacts.email ? (
            <li>
              <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            </li>
          ) : null}
          {contacts.whatsapp ? (
            <li>
              <a
                href={`https://wa.me/${contacts.whatsapp.replace(/\D/g, "")}`}
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </li>
          ) : null}
          {contacts.linkedinUrl ? (
            <li>
              <a href={contacts.linkedinUrl} rel="noopener noreferrer">
                LinkedIn
              </a>
            </li>
          ) : null}
          {contacts.websiteUrl ? (
            <li>
              <a href={contacts.websiteUrl} rel="noopener noreferrer">
                Site
              </a>
            </li>
          ) : null}
          <li>
            <a href={`/perfil/${profile.slug}/contato?lang=${profile.locale}`}>
              Salvar contato
            </a>
          </li>
        </ul>
      </section>

      {sections.map((section) => (
        <section key={section.key}>
          <h2>{PROFILE_SECTION_LABELS[section.key]}</h2>
          <ul>
            {section.entries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.title}</strong>
                {entry.subtitle ? ` — ${entry.subtitle}` : ""}
                {entry.description ? <p>{entry.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {recentContent.length > 0 ? (
        <section>
          <h2>Conteúdo recente</h2>
          <ul>
            {recentContent.map((item) => (
              <li key={item.key}>
                {item.url ? (
                  <a href={item.url} rel="noopener noreferrer">
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
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

  return <MinimalPublicProfile profile={result.profile} />;
}
