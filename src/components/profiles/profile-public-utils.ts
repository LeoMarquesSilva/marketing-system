/**
 * Helpers puros da página pública de perfil — testáveis sem DOM.
 */

import {
  PROFILE_EVENT_SOURCES,
  PROFILE_SECTION_LABELS,
  type ProfileEventSource,
  type ProfileLocale,
  type ProfileSectionKey,
  type PublicProfessionalProfile,
} from "@/lib/profiles/types";

export const FIRM_WEBSITE_URL = "https://bismarchipires.com.br";
export const FIRM_LOGO_SRC = "/LOGO%20HORIZONTAL%20AZUL.png";
export const FIRM_LOGO_ALT = "Bismarchi | Pires";

const SECTION_LABELS_EN: Record<ProfileSectionKey, string> = {
  practice: "Practice areas",
  education: "Academic background",
  knowledge: "Specialties and knowledge",
  highlights: "Recognition and highlights",
  timeline: "Journey at Bismarchi | Pires",
};

export function isAllowedProfileSource(
  source: string | null | undefined
): source is ProfileEventSource {
  if (!source) return false;
  return (PROFILE_EVENT_SOURCES as readonly string[]).includes(source);
}

export function getProfileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

/** Exibe data pública sempre em DD/MM/AAAA (calendário da ISO, sem fuso local). */
export function formatProfilePublishedAtBr(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = String(parsed.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

export function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

export function sectionLabel(key: ProfileSectionKey, locale: ProfileLocale): string {
  if (locale === "en") return SECTION_LABELS_EN[key];
  return PROFILE_SECTION_LABELS[key];
}

export type ProfileUiCopy = {
  saveContact: string;
  whatsapp: string;
  email: string;
  linkedin: string;
  share: string;
  website: string;
  recentContent: string;
  viewAllPublications: string;
  readFullBio: string;
  institutionalNotice: string;
  copyContacts: string;
  contactsCopied: string;
  shareCopied: string;
  shareFailed: string;
  langPt: string;
  langEn: string;
  campaign: string;
};

export function profileUiCopy(locale: ProfileLocale): ProfileUiCopy {
  if (locale === "en") {
    return {
      saveContact: "Save contact",
      whatsapp: "WhatsApp",
      email: "Email",
      linkedin: "LinkedIn",
      share: "Share",
      website: "Website",
      recentContent: "Publications and content",
      viewAllPublications: "View all publications",
      readFullBio: "Read the full career path",
      institutionalNotice:
        "This is an institutional professional profile of Bismarchi | Pires.",
      copyContacts: "Copy visible contacts",
      contactsCopied: "Contacts copied",
      shareCopied: "Link copied",
      shareFailed: "Unable to share",
      langPt: "PT",
      langEn: "EN",
      campaign: "Campaign",
    };
  }
  return {
    saveContact: "Salvar contato",
    whatsapp: "WhatsApp",
    email: "E-mail",
    linkedin: "LinkedIn",
    share: "Compartilhar",
    website: "Site",
    recentContent: "Publicações e conteúdos",
    viewAllPublications: "Ver todas as publicações",
    readFullBio: "Conheça a trajetória completa",
    institutionalNotice:
      "Este é um perfil profissional institucional do Bismarchi | Pires.",
    copyContacts: "Copiar contatos visíveis",
    contactsCopied: "Contatos copiados",
    shareCopied: "Link copiado",
    shareFailed: "Não foi possível compartilhar",
    langPt: "PT",
    langEn: "EN",
    campaign: "Campanha",
  };
}

export function buildProfilePathQuery(options: {
  lang?: ProfileLocale | null;
  source?: string | null;
}): string {
  const params = new URLSearchParams();
  if (options.lang === "en") {
    params.set("lang", "en");
  }
  if (isAllowedProfileSource(options.source)) {
    params.set("source", options.source);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function buildLanguageSwitchHref(
  slug: string,
  targetLocale: ProfileLocale,
  source?: string | null
): string {
  return `/perfil/${slug}${buildProfilePathQuery({
    lang: targetLocale === "en" ? "en" : null,
    source,
  })}`;
}

export function buildContactDownloadHref(
  slug: string,
  locale: ProfileLocale,
  source?: string | null
): string {
  return `/perfil/${slug}/contato${buildProfilePathQuery({
    lang: locale === "en" ? "en" : null,
    source,
  })}`;
}

export function buildCanonicalProfileUrl(input: {
  origin: string;
  slug: string;
  locale: ProfileLocale;
  source?: string | null;
}): string {
  const origin = input.origin.replace(/\/$/, "");
  return `${origin}/perfil/${input.slug}${buildProfilePathQuery({
    lang: input.locale === "en" ? "en" : null,
    source: input.source,
  })}`;
}

/** Texto com os campos de contato atualmente visíveis (fallback do vCard). */
export function formatVisibleContacts(
  profile: PublicProfessionalProfile
): string {
  const lines: string[] = [profile.identity.name];
  if (profile.identity.role) lines.push(profile.identity.role);
  if (profile.contacts.email) lines.push(profile.contacts.email);
  if (profile.contacts.whatsapp) lines.push(profile.contacts.whatsapp);
  if (profile.contacts.linkedinUrl) lines.push(profile.contacts.linkedinUrl);
  if (profile.contacts.websiteUrl) lines.push(profile.contacts.websiteUrl);
  return lines.join("\n");
}

export async function shareOrCopyProfileUrl(input: {
  url: string;
  title: string;
  text?: string;
  navigatorLike?: {
    share?: (data: ShareData) => Promise<void>;
    clipboard?: { writeText: (value: string) => Promise<void> };
  };
}): Promise<"shared" | "copied"> {
  const nav = input.navigatorLike;
  if (nav?.share) {
    try {
      await nav.share({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return "shared";
    } catch {
      // fall through to clipboard
    }
  }
  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(input.url);
    return "copied";
  }
  throw new Error("share_unavailable");
}

export async function downloadVCardOrFail(input: {
  href: string;
  filenameHint: string;
  fetchImpl?: typeof fetch;
}): Promise<"downloaded" | "failed"> {
  const fetchFn = input.fetchImpl ?? fetch;
  try {
    const response = await fetchFn(input.href, { credentials: "same-origin" });
    if (!response.ok) return "failed";
    const blob = await response.blob();
    if (typeof window === "undefined" || typeof document === "undefined") {
      return "downloaded";
    }
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = input.filenameHint.endsWith(".vcf")
      ? input.filenameHint
      : `${input.filenameHint}.vcf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return "downloaded";
  } catch {
    return "failed";
  }
}
