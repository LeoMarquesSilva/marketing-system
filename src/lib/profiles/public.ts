/**
 * Projeção pública sanitizada dos perfis profissionais.
 *
 * Só perfis `published` chegam ao navegador. Contato privado, flags de admin,
 * colunas de auditoria e localizações não aprovadas nunca saem daqui.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createProfileAdminClient, resolveProfilePhotoUrl } from "@/lib/profiles/admin";
import { resolveCampaignMessage } from "@/lib/profiles/campaign";
import { listRecentProfessionalContent } from "@/lib/profiles/content";
import {
  localizeField,
  selectApprovedLocalization,
} from "@/lib/profiles/localization";
import type {
  ProfileCampaign,
  ProfileContentItem,
  ProfileLocale,
  ProfileSectionKey,
  ProfessionalProfileLocalization,
  PublicProfessionalProfile,
  PublicProfileEntry,
  PublicProfileSection,
} from "@/lib/profiles/types";

type Row = Record<string, unknown>;

const PROFILE_PUBLIC_COLUMNS =
  "id, user_id, slug, status, photo_url, oab, joined_on, professional_email, " +
  "professional_phone, linkedin_url, website_url, show_tenure, show_email, " +
  "show_whatsapp, show_linkedin, show_website";

const LOCALIZATION_COLUMNS =
  "profile_id, locale, is_approved, display_name, role, practice_area, tagline, bio";

const CAMPAIGN_COLUMNS =
  "enabled, starts_at, ends_at, title_pt, title_en, message_pt, message_en, " +
  "call_to_action_pt, call_to_action_en";

export type PublicProfileLookupResult =
  | { kind: "profile"; profile: PublicProfessionalProfile }
  | { kind: "redirect"; slug: string }
  | null;

export type PublicProfileRow = {
  id: string;
  user_id: string;
  slug: string;
  status: string;
  photo_url: string | null;
  oab: string | null;
  joined_on: string | null;
  professional_email: string | null;
  professional_phone: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  show_tenure: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  show_linkedin: boolean;
  show_website: boolean;
};

export type PublicSectionRow = {
  id: string;
  section_key: ProfileSectionKey;
  enabled: boolean;
  sort_order: number;
};

export type PublicEntryRow = {
  id: string;
  section_id: string;
  entry_type: string;
  link_url: string | null;
  image_url: string | null;
  occurred_on: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type PublicEntryLocalizationRow = {
  entry_id: string;
  locale: ProfileLocale;
  title: string;
  subtitle: string | null;
  description: string | null;
};

/** Rótulo de tempo de casa — puro, sem I/O. */
export function buildTenureLabel(
  joinedOn: string | null | undefined,
  showTenure: boolean,
  locale: ProfileLocale
): string | null {
  if (!showTenure || !joinedOn) return null;
  const year = String(joinedOn).slice(0, 4);
  if (!/^\d{4}$/.test(year)) return null;
  return locale === "en" ? `Since ${year}` : `Desde ${year}`;
}

/** Contatos públicos: valor só sai quando o flag show_* está ligado. */
export function projectPublicContacts(input: {
  professionalEmail: string | null;
  professionalPhone: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  showEmail: boolean;
  showWhatsapp: boolean;
  showLinkedin: boolean;
  showWebsite: boolean;
}): PublicProfessionalProfile["contacts"] {
  return {
    email: input.showEmail ? input.professionalEmail : null,
    whatsapp: input.showWhatsapp ? input.professionalPhone : null,
    linkedinUrl: input.showLinkedin ? input.linkedinUrl : null,
    websiteUrl: input.showWebsite ? input.websiteUrl : null,
  };
}

function mapLocalizationRow(row: Row): ProfessionalProfileLocalization {
  return {
    locale: row.locale as ProfileLocale,
    isApproved: Boolean(row.is_approved),
    displayName: (row.display_name as string | null) ?? null,
    role: (row.role as string | null) ?? null,
    practiceArea: (row.practice_area as string | null) ?? null,
    tagline: (row.tagline as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
  };
}

/**
 * Identidade localizada. Inglês não aprovado cai inteiro para PT;
 * inglês aprovado ainda cai campo a campo quando o opcional está vazio.
 */
export function projectPublicIdentity(input: {
  locale: ProfileLocale;
  pt: ProfessionalProfileLocalization;
  en: ProfessionalProfileLocalization | null;
  oab: string | null;
  photoUrl: string | null;
  joinedOn: string | null;
  showTenure: boolean;
}): PublicProfessionalProfile["identity"] {
  const enApproved =
    input.locale === "en" && Boolean(input.en?.isApproved) ? input.en : null;
  // selectApprovedLocalization documenta a regra de “bloco inteiro”;
  // localizeField aplica o fallback por campo nos opcionais.
  selectApprovedLocalization(input.pt, input.en, input.locale);

  const name = localizeField(
    { "pt-BR": input.pt.displayName, en: enApproved?.displayName ?? null },
    input.locale
  );
  const role = localizeField(
    { "pt-BR": input.pt.role, en: enApproved?.role ?? null },
    input.locale
  );
  const practiceArea = localizeField(
    { "pt-BR": input.pt.practiceArea, en: enApproved?.practiceArea ?? null },
    input.locale
  );
  const tagline = localizeField(
    { "pt-BR": input.pt.tagline, en: enApproved?.tagline ?? null },
    input.locale
  );
  const bio = localizeField(
    { "pt-BR": input.pt.bio, en: enApproved?.bio ?? null },
    input.locale
  );

  return {
    name,
    role,
    practiceArea,
    oab: input.oab,
    photoUrl: input.photoUrl,
    tagline,
    bio,
    joinedOn: input.showTenure ? input.joinedOn : null,
    tenureLabel: buildTenureLabel(input.joinedOn, input.showTenure, input.locale),
  };
}

/** Seções habilitadas + entradas visíveis, ordenadas e localizadas. */
export function projectPublicSections(input: {
  locale: ProfileLocale;
  sections: PublicSectionRow[];
  entries: PublicEntryRow[];
  entryLocalizations: PublicEntryLocalizationRow[];
}): PublicProfileSection[] {
  const locsByEntry = new Map<string, Partial<Record<ProfileLocale, PublicEntryLocalizationRow>>>();
  for (const loc of input.entryLocalizations) {
    const bucket = locsByEntry.get(loc.entry_id) ?? {};
    bucket[loc.locale] = loc;
    locsByEntry.set(loc.entry_id, bucket);
  }

  const entriesBySection = new Map<string, PublicEntryRow[]>();
  for (const entry of input.entries) {
    if (!entry.is_visible) continue;
    const list = entriesBySection.get(entry.section_id) ?? [];
    list.push(entry);
    entriesBySection.set(entry.section_id, list);
  }

  return input.sections
    .filter((section) => section.enabled)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((section) => {
      const entries = (entriesBySection.get(section.id) ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((entry): PublicProfileEntry => {
          const locs = locsByEntry.get(entry.id) ?? {};
          const pt = locs["pt-BR"];
          const en = locs.en;
          return {
            id: entry.id,
            entryType: entry.entry_type,
            title: localizeField(
              { "pt-BR": pt?.title ?? null, en: en?.title ?? null },
              input.locale
            ),
            subtitle: (() => {
              const value = localizeField(
                { "pt-BR": pt?.subtitle ?? null, en: en?.subtitle ?? null },
                input.locale
              );
              return value || null;
            })(),
            description: (() => {
              const value = localizeField(
                {
                  "pt-BR": pt?.description ?? null,
                  en: en?.description ?? null,
                },
                input.locale
              );
              return value || null;
            })(),
            linkUrl: entry.link_url,
            imageUrl: entry.image_url,
            occurredOn: entry.occurred_on,
          };
        });

      return { key: section.section_key, entries };
    });
}

export function mapCampaignRow(row: Row | null | undefined): ProfileCampaign | null {
  if (!row) return null;
  return {
    enabled: Boolean(row.enabled),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    titlePt: (row.title_pt as string | null) ?? "",
    titleEn: (row.title_en as string | null) ?? "",
    messagePt: (row.message_pt as string | null) ?? "",
    messageEn: (row.message_en as string | null) ?? "",
    callToActionPt: (row.call_to_action_pt as string | null) ?? null,
    callToActionEn: (row.call_to_action_en as string | null) ?? null,
  };
}

function asProfileRow(row: Row): PublicProfileRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    slug: row.slug as string,
    status: row.status as string,
    photo_url: (row.photo_url as string | null) ?? null,
    oab: (row.oab as string | null) ?? null,
    joined_on: (row.joined_on as string | null) ?? null,
    professional_email: (row.professional_email as string | null) ?? null,
    professional_phone: (row.professional_phone as string | null) ?? null,
    linkedin_url: (row.linkedin_url as string | null) ?? null,
    website_url: (row.website_url as string | null) ?? null,
    show_tenure: Boolean(row.show_tenure),
    show_email: Boolean(row.show_email),
    show_whatsapp: Boolean(row.show_whatsapp),
    show_linkedin: Boolean(row.show_linkedin),
    show_website: Boolean(row.show_website),
  };
}

async function loadHiddenContentKeys(
  db: SupabaseClient,
  profileId: string
): Promise<Set<string>> {
  const { data, error } = await db
    .from("professional_profile_content_overrides")
    .select("source_type, source_id, is_hidden")
    .eq("profile_id", profileId)
    .eq("is_hidden", true);

  if (error) return new Set();
  return new Set(
    ((data ?? []) as Row[]).map(
      (row) => `${row.source_type as string}:${row.source_id as string}`
    )
  );
}

async function loadRecentContentSafe(
  db: SupabaseClient,
  input: { profileId: string; userId: string; userName: string }
): Promise<ProfileContentItem[]> {
  try {
    const hiddenKeys = await loadHiddenContentKeys(db, input.profileId);
    return await listRecentProfessionalContent(db, {
      userId: input.userId,
      userName: input.userName,
      hiddenKeys,
      limit: 3,
    });
  } catch {
    return [];
  }
}

async function loadCampaignMessageSafe(
  db: SupabaseClient,
  locale: ProfileLocale,
  now: Date
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from("professional_profile_campaign")
      .select(CAMPAIGN_COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (error) return null;
    return resolveCampaignMessage(mapCampaignRow(data as unknown as Row | null), locale, now);
  } catch {
    return null;
  }
}

async function assemblePublicProfile(
  db: SupabaseClient,
  row: PublicProfileRow,
  locale: ProfileLocale,
  now: Date
): Promise<PublicProfessionalProfile> {
  const [
    { data: localizationRows },
    { data: sectionRows },
    { data: userRow },
  ] = await Promise.all([
    db
      .from("professional_profile_localizations")
      .select(LOCALIZATION_COLUMNS)
      .eq("profile_id", row.id),
    db
      .from("professional_profile_sections")
      .select("id, section_key, enabled, sort_order")
      .eq("profile_id", row.id)
      .order("sort_order", { ascending: true }),
    db.from("users").select("name, avatar_url").eq("id", row.user_id).maybeSingle(),
  ]);

  const localizations = ((localizationRows ?? []) as Row[]).map(mapLocalizationRow);
  const pt = localizations.find((item) => item.locale === "pt-BR") ?? {
    locale: "pt-BR" as const,
    isApproved: true,
    displayName: null,
    role: null,
    practiceArea: null,
    tagline: null,
    bio: null,
  };
  const en = localizations.find((item) => item.locale === "en") ?? null;

  const sections = ((sectionRows ?? []) as Row[]).map(
    (section): PublicSectionRow => ({
      id: section.id as string,
      section_key: section.section_key as ProfileSectionKey,
      enabled: Boolean(section.enabled),
      sort_order: (section.sort_order as number | null) ?? 0,
    })
  );

  const sectionIds = sections.map((section) => section.id);
  let entries: PublicEntryRow[] = [];
  let entryLocalizations: PublicEntryLocalizationRow[] = [];

  if (sectionIds.length > 0) {
    const { data: entryRows } = await db
      .from("professional_profile_entries")
      .select(
        "id, section_id, entry_type, link_url, image_url, occurred_on, sort_order, is_visible"
      )
      .in("section_id", sectionIds)
      .order("sort_order", { ascending: true });

    entries = ((entryRows ?? []) as Row[]).map((entry) => ({
      id: entry.id as string,
      section_id: entry.section_id as string,
      entry_type: entry.entry_type as string,
      link_url: (entry.link_url as string | null) ?? null,
      image_url: (entry.image_url as string | null) ?? null,
      occurred_on: (entry.occurred_on as string | null) ?? null,
      sort_order: (entry.sort_order as number | null) ?? 0,
      is_visible: Boolean(entry.is_visible),
    }));

    const entryIds = entries.map((entry) => entry.id);
    if (entryIds.length > 0) {
      const { data: entryLocRows } = await db
        .from("professional_profile_entry_localizations")
        .select("entry_id, locale, title, subtitle, description")
        .in("entry_id", entryIds);

      entryLocalizations = ((entryLocRows ?? []) as Row[]).map((loc) => ({
        entry_id: loc.entry_id as string,
        locale: loc.locale as ProfileLocale,
        title: (loc.title as string | null) ?? "",
        subtitle: (loc.subtitle as string | null) ?? null,
        description: (loc.description as string | null) ?? null,
      }));
    }
  }

  const identity = projectPublicIdentity({
    locale,
    pt,
    en,
    oab: row.oab,
    photoUrl: resolveProfilePhotoUrl(
      row.photo_url,
      ((userRow as unknown as Row | null)?.avatar_url as string | null) ?? null
    ),
    joinedOn: row.joined_on,
    showTenure: row.show_tenure,
  });

  const userName =
    ((userRow as unknown as Row | null)?.name as string | null)?.trim() ||
    identity.name ||
    pt.displayName ||
    "";

  const [recentContent, campaignMessage] = await Promise.all([
    loadRecentContentSafe(db, {
      profileId: row.id,
      userId: row.user_id,
      userName,
    }),
    loadCampaignMessageSafe(db, locale, now),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    locale,
    identity,
    contacts: projectPublicContacts({
      professionalEmail: row.professional_email,
      professionalPhone: row.professional_phone,
      linkedinUrl: row.linkedin_url,
      websiteUrl: row.website_url,
      showEmail: row.show_email,
      showWhatsapp: row.show_whatsapp,
      showLinkedin: row.show_linkedin,
      showWebsite: row.show_website,
    }),
    sections: projectPublicSections({
      locale,
      sections,
      entries,
      entryLocalizations,
    }),
    recentContent,
    campaignMessage,
  };
}

/**
 * Resolve um slug público. Distingue perfil atual, redirect de slug antigo
 * e ausência/rascunho/arquivado (null).
 */
export async function getPublicProfessionalProfile(
  slug: string,
  locale: ProfileLocale,
  options?: { client?: SupabaseClient; now?: Date }
): Promise<PublicProfileLookupResult> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const db = options?.client ?? createProfileAdminClient();
  const now = options?.now ?? new Date();

  const { data: profileData, error: profileError } = await db
    .from("professional_profiles")
    .select(PROFILE_PUBLIC_COLUMNS)
    .eq("slug", normalized)
    .maybeSingle();

  if (profileError) return null;

  if (profileData) {
    const row = asProfileRow(profileData as unknown as Row);
    if (row.status !== "published") return null;
    const profile = await assemblePublicProfile(db, row, locale, now);
    return { kind: "profile", profile };
  }

  const { data: redirectData, error: redirectError } = await db
    .from("professional_profile_slug_redirects")
    .select("old_slug, profile_id")
    .eq("old_slug", normalized)
    .maybeSingle();

  if (redirectError || !redirectData) return null;

  const profileId = (redirectData as unknown as Row).profile_id as string;
  const { data: redirectedProfile, error: redirectedError } = await db
    .from("professional_profiles")
    .select("slug, status")
    .eq("id", profileId)
    .maybeSingle();

  if (redirectedError || !redirectedProfile) return null;
  const redirected = redirectedProfile as unknown as Row;
  if ((redirected.status as string) !== "published") return null;

  return { kind: "redirect", slug: redirected.slug as string };
}

/** Registra contact_download sem derrubar o download do vCard. */
export async function recordContactDownloadEvent(
  profileId: string,
  locale: ProfileLocale,
  options?: { client?: SupabaseClient; source?: "direct" | "nfc" | "qr" | "share" }
): Promise<void> {
  const { recordProfileEvent } = await import("@/lib/profiles/metrics-record");
  await recordProfileEvent(
    {
      profileId,
      eventType: "contact_download",
      source: options?.source ?? "direct",
      locale,
    },
    { client: options?.client }
  );
}
