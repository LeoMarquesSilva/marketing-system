import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileSectionList } from "@/components/profiles/profile-section-list";
import type { PublicProfessionalProfile } from "@/lib/profiles/types";

const reelUrl =
  "https://www.instagram.com/reel/DAtegZsygMk/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==";

function profileWithLink(linkUrl: string): PublicProfessionalProfile {
  return {
    id: "p-carlos",
    slug: "carlos-zamboni",
    locale: "pt-BR",
    identity: {
      name: "Carlos Zamboni",
      role: "Consultor em Liderança e Gestão Estratégica",
      practiceArea: "Liderança, Gestão Estratégica e Transformação Organizacional",
      oab: null,
      photoUrl: null,
      tagline: "Liderar é inspirar, transformar e construir um legado.",
      bio: "Consultor com mais de 35 anos de experiência em liderança.",
      joinedOn: null,
      tenureLabel: null,
    },
    contacts: {
      email: null,
      whatsapp: null,
      linkedinUrl: null,
      websiteUrl: null,
    },
    sections: [
      {
        key: "timeline",
        entries: [
          {
            id: "entry-reel",
            entryType: "milestone",
            title: "Reconhecimento à trajetória na CPFL Energia",
            subtitle: null,
            description: "Registro da despedida e do reconhecimento das equipes.",
            linkUrl,
            imageUrl: null,
            occurredOn: null,
          },
        ],
      },
    ],
    recentContent: [],
    campaignMessage: null,
    campaignTitle: null,
  };
}

describe("ProfileSectionList — Reels", () => {
  it("mostra player oficial e fallback externo para um Reel", () => {
    const markup = renderToStaticMarkup(
      <ProfileSectionList profile={profileWithLink(reelUrl)} />
    );

    expect(markup).toContain('class="pp-section__reel-frame"');
    expect(markup).toContain(
      'src="https://www.instagram.com/reel/DAtegZsygMk/embed/"'
    );
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain(
      'title="Reel: Reconhecimento à trajetória na CPFL Energia"'
    );
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain("Assistir no Instagram");
  });

  it("preserva link textual e não cria iframe para links comuns", () => {
    const markup = renderToStaticMarkup(
      <ProfileSectionList
        profile={profileWithLink("https://example.com/artigo")}
      />
    );

    expect(markup).toContain('href="https://example.com/artigo"');
    expect(markup).not.toContain("pp-section__reel-frame");
    expect(markup).not.toContain("Assistir no Instagram");
  });
});
