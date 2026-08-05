import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfessionalProfilePage } from "@/components/profiles/professional-profile-page";
import {
  buildCanonicalProfileUrl,
  buildLanguageSwitchHref,
  downloadVCardOrFail,
  formatProfilePublishedAtBr,
  formatVisibleContacts,
  getProfileInitials,
  shareOrCopyProfileUrl,
  whatsappHref,
} from "@/components/profiles/profile-public-utils";
import type { PublicProfessionalProfile } from "@/lib/profiles/types";

vi.mock("@/components/profiles/professional-profile-page.module.css", () => ({
  default: { root: "pp-root-mock" },
}));

function makeProfile(
  overrides: Partial<PublicProfessionalProfile> = {}
): PublicProfessionalProfile {
  return {
    id: "p1",
    slug: "leticia-rodrigues",
    locale: "pt-BR",
    identity: {
      name: "Letícia Rodrigues",
      role: "Sócia",
      practiceArea: "Tributário",
      oab: "OAB/SP 123456",
      photoUrl: "https://cdn.exemplo.com/leticia.jpg",
      tagline: "A advocacia começa pela escuta.",
      bio: "Atua em contencioso tributário.",
      joinedOn: "2019-03-01",
      tenureLabel: "Desde 2019",
    },
    contacts: {
      email: "leticia@bismarchipires.com.br",
      whatsapp: "+55 19 99999-9999",
      linkedinUrl: "https://linkedin.com/in/leticia",
      websiteUrl: "https://bismarchipires.com.br",
    },
    sections: [
      {
        key: "practice",
        entries: [
          {
            id: "e1",
            entryType: "area",
            title: "Contencioso tributário",
            subtitle: null,
            description: null,
            linkUrl: null,
            imageUrl: null,
            occurredOn: null,
          },
        ],
      },
      {
        key: "education",
        entries: [
          {
            id: "e2",
            entryType: "degree",
            title: "USP",
            subtitle: "Direito",
            description: null,
            linkUrl: null,
            imageUrl: null,
            occurredOn: "2010-01-01",
          },
        ],
      },
    ],
    recentContent: [
      {
        sourceType: "instagram",
        sourceId: "1",
        key: "instagram:1",
        title: "Post um",
        imageUrl: null,
        url: "https://instagram.com/p/1",
        publishedAt: "2026-07-01T00:00:00.000Z",
      },
      {
        sourceType: "instagram",
        sourceId: "2",
        key: "instagram:2",
        title: "Post dois",
        imageUrl: null,
        url: "https://instagram.com/p/2",
        publishedAt: "2026-07-02T00:00:00.000Z",
      },
      {
        sourceType: "instagram",
        sourceId: "3",
        key: "instagram:3",
        title: "Post três",
        imageUrl: null,
        url: "https://instagram.com/p/3",
        publishedAt: "2026-07-03T00:00:00.000Z",
      },
      {
        sourceType: "instagram",
        sourceId: "4",
        key: "instagram:4",
        title: "Post quatro — não deve aparecer",
        imageUrl: null,
        url: "https://instagram.com/p/4",
        publishedAt: "2026-07-04T00:00:00.000Z",
      },
    ],
    campaignMessage: "A advocacia começa pela escuta.",
    campaignTitle: "Dia do Advogado 2026",
    ...overrides,
  };
}

describe("ProfessionalProfilePage — hero e identidade", () => {
  it("exibe foto, logo, nome, cargo, área, OAB e tagline", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    expect(markup).toContain("Letícia Rodrigues");
    expect(markup).toContain("Sócia");
    expect(markup).toContain("Tributário");
    expect(markup).toContain("OAB/SP 123456");
    expect(markup).toContain("A advocacia começa pela escuta.");
    expect(markup).toContain("https://cdn.exemplo.com/leticia.jpg");
    expect(markup).toContain("/LOGO%20HORIZONTAL%20AZUL.png");
    expect(markup).toContain('alt="Bismarchi | Pires"');
  });

  it("usa a composição concierge e preserva a hierarquia mobile", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    expect(markup).toContain("pp-atmosphere");
    expect(markup).toContain("pp-profile-card");
    expect(markup).toContain("pp-hero__portrait");
    expect(markup).toContain("pp-hero__identity");
  });

  it("mantém hero, ações e seções visíveis no HTML inicial", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );

    expect(markup).toContain("Letícia Rodrigues");
    expect(markup).toContain("Salvar contato");
    expect(markup).toContain("Áreas de atuação");
    expect(markup).not.toMatch(/opacity\s*:\s*0(?:[;"']|$)/);
  });

  it("usa avatar com iniciais quando a foto está ausente", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage
        profile={makeProfile({
          identity: {
            ...makeProfile().identity,
            photoUrl: null,
          },
        })}
      />
    );
    expect(markup).toContain("profile-initials-avatar");
    expect(markup).toContain("LR");
    expect(markup).not.toContain("https://cdn.exemplo.com/leticia.jpg");
  });
});

describe("ProfessionalProfilePage — contatos", () => {
  it("renderiza CTA primário e dock preservando ações públicas", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    expect(markup).toContain("pp-action--primary");
    expect(markup).toContain("pp-contact-dock");
    expect(markup).toContain('data-action="whatsapp"');
    expect(markup).toContain('data-action="linkedin"');
  });

  it("sempre exibe Salvar contato apontando para a rota de vCard", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} source="nfc" />
    );
    expect(markup).toContain("Salvar contato");
    expect(markup).toContain('data-action="save-contact"');
    expect(markup).toContain('/perfil/leticia-rodrigues/contato?source=nfc');
  });

  it("omite e-mail e WhatsApp quando privados", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage
        profile={makeProfile({
          contacts: {
            email: null,
            whatsapp: null,
            linkedinUrl: "https://linkedin.com/in/leticia",
            websiteUrl: "https://bismarchipires.com.br",
          },
        })}
      />
    );
    expect(markup).not.toContain('data-action="email"');
    expect(markup).not.toContain('data-action="whatsapp"');
    expect(markup).not.toContain("mailto:");
    expect(markup).not.toContain("wa.me");
    expect(markup).toContain('data-action="linkedin"');
    expect(markup).toContain('data-action="website"');
    expect(markup).toContain('data-action="share"');
    expect(markup).toContain("Salvar contato");
  });

  it("mantém a ordem das ações de contato", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    const actions = [
      "save-contact",
      "linkedin",
      "share",
      "email",
      "whatsapp",
      "website",
    ];
    const indexes = actions.map((action) =>
      markup.indexOf(`data-action="${action}"`)
    );
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("não cria wrappers focáveis além das ações interativas", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );

    expect(markup).not.toContain('tabindex="0"');
  });
});

describe("ProfessionalProfilePage — campanha, seções e conteúdo", () => {
  it("exibe faixa de campanha somente quando há mensagem ou título", () => {
    const withCampaign = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    expect(withCampaign).toContain('data-campaign="true"');
    expect(withCampaign).toContain("A advocacia começa pela escuta.");
    expect(withCampaign).toContain("Dia do Advogado 2026");
    expect(withCampaign).not.toContain('role="status"');

    const withoutCampaign = renderToStaticMarkup(
      <ProfessionalProfilePage
        profile={makeProfile({ campaignMessage: null, campaignTitle: null })}
      />
    );
    expect(withoutCampaign).not.toContain('data-campaign="true"');
  });

  it("renderiza seções habilitadas na ordem configurada", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    const practice = markup.indexOf('data-section="practice"');
    const education = markup.indexOf('data-section="education"');
    expect(practice).toBeGreaterThan(-1);
    expect(education).toBeGreaterThan(practice);
    expect(markup).toContain("Áreas de atuação");
    expect(markup).toContain("Formação acadêmica");
    expect(markup).toContain("Contencioso tributário");
    expect(markup).toContain("USP");
  });

  it("mostra três conteúdos inicialmente e oferece ver todas", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    expect(markup).toContain("Post um");
    expect(markup).toContain("Post dois");
    expect(markup).toContain("Post três");
    expect(markup).not.toContain("Post quatro");
    expect(markup).toContain("Publicações e conteúdos");
    expect(markup).toContain("Ver todas as publicações");
    expect(markup).toContain("Instagram");
    expect(markup).toContain(">01/07/2026</time>");
    expect(markup).toContain(">02/07/2026</time>");
    expect(markup).toContain(">03/07/2026</time>");
  });

  it("formatProfilePublishedAtBr usa sempre DD/MM/AAAA", () => {
    expect(formatProfilePublishedAtBr("2026-07-01T00:00:00.000Z")).toBe("01/07/2026");
    expect(formatProfilePublishedAtBr("2026-12-31")).toBe("31/12/2026");
    expect(formatProfilePublishedAtBr(null)).toBeNull();
  });

  it("resume o mini-CV e oferece trajetória completa", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage
        profile={makeProfile({
          identity: {
            ...makeProfile().identity,
            bio: "Resumo curto do profissional.\n\nParágrafo longo da trajetória completa.",
          },
        })}
      />
    );
    expect(markup).toContain("Resumo curto do profissional.");
    expect(markup).toContain("Conheça a trajetória completa");
    expect(markup).toContain("Parágrafo longo da trajetória completa.");
    expect(markup).toContain("pp-hero__bio-more");
  });
});

describe("ProfessionalProfilePage — idioma e compartilhamento", () => {
  it("alterna PT/EN preservando slug e source", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} source="qr" />
    );
    expect(markup).toContain('href="/perfil/leticia-rodrigues?source=qr"');
    expect(markup).toContain('href="/perfil/leticia-rodrigues?lang=en&amp;source=qr"');
    expect(markup).toContain('data-lang="pt"');
    expect(markup).toContain('data-lang="en"');
  });

  it("buildLanguageSwitchHref omite lang em PT e preserva source permitido", () => {
    expect(buildLanguageSwitchHref("leticia-rodrigues", "pt-BR", "nfc")).toBe(
      "/perfil/leticia-rodrigues?source=nfc"
    );
    expect(buildLanguageSwitchHref("leticia-rodrigues", "en", "share")).toBe(
      "/perfil/leticia-rodrigues?lang=en&source=share"
    );
    expect(buildLanguageSwitchHref("leticia-rodrigues", "en", "evil")).toBe(
      "/perfil/leticia-rodrigues?lang=en"
    );
  });

  it("share usa navigator.share quando disponível", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await shareOrCopyProfileUrl({
      url: "https://example.com/perfil/leticia-rodrigues?source=share",
      title: "Letícia",
      navigatorLike: { share },
    });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/perfil/leticia-rodrigues?source=share",
      })
    );
  });

  it("share cai para clipboard com URL canônica quando share não existe", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareOrCopyProfileUrl({
      url: "https://example.com/perfil/leticia-rodrigues",
      title: "Letícia",
      navigatorLike: { clipboard: { writeText } },
    });
    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "https://example.com/perfil/leticia-rodrigues"
    );
  });

  it("preserva source na URL canônica só quando permitido", () => {
    expect(
      buildCanonicalProfileUrl({
        origin: "https://example.com",
        slug: "leticia-rodrigues",
        locale: "pt-BR",
        source: "nfc",
      })
    ).toBe("https://example.com/perfil/leticia-rodrigues?source=nfc");

    expect(
      buildCanonicalProfileUrl({
        origin: "https://example.com",
        slug: "leticia-rodrigues",
        locale: "en",
        source: "utm_spam",
      })
    ).toBe("https://example.com/perfil/leticia-rodrigues?lang=en");
  });
});

describe("ProfessionalProfilePage — vCard, mobile e utilitários", () => {
  it("falha do vCard sinaliza fallback e formata contatos visíveis", async () => {
    const failed = await downloadVCardOrFail({
      href: "/perfil/leticia-rodrigues/contato",
      filenameHint: "leticia",
      fetchImpl: vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch,
    });
    expect(failed).toBe("failed");

    const profile = makeProfile({
      contacts: {
        email: "leticia@bismarchipires.com.br",
        whatsapp: null,
        linkedinUrl: null,
        websiteUrl: null,
      },
    });
    expect(formatVisibleContacts(profile)).toContain("Letícia Rodrigues");
    expect(formatVisibleContacts(profile)).toContain(
      "leticia@bismarchipires.com.br"
    );
    expect(formatVisibleContacts(profile)).not.toContain("99999");
  });

  it("aplica alvos de toque ≥ 44px e evita overflow horizontal no mobile", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage profile={makeProfile()} />
    );
    expect(markup).toContain("pp-root");
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("min-w-11");
    expect(markup).toContain("pp-action");
    expect(getProfileInitials("Letícia Rodrigues")).toBe("LR");
    expect(whatsappHref("+55 (19) 99999-9999")).toBe("https://wa.me/5519999999999");
  });

  it("footer institucional não inventa telefone privado do escritório", () => {
    const markup = renderToStaticMarkup(
      <ProfessionalProfilePage
        profile={makeProfile({
          contacts: {
            email: null,
            whatsapp: null,
            linkedinUrl: null,
            websiteUrl: null,
          },
        })}
      />
    );
    expect(markup).toContain("perfil profissional institucional");
    expect(markup).toContain("bismarchipires.com.br");
    expect(markup).not.toContain("tel:");
  });
});
