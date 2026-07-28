/**
 * Repositório e regras de administração dos perfis profissionais.
 *
 * As funções puras deste módulo (checklist de publicação, plano de save,
 * completude, filtros) são testadas isoladamente; as operações de banco usam o
 * client de service role e sempre listam colunas explicitamente.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { makeProfileSlug, nextProfileSlugCandidate } from "@/lib/profiles/slug";
import type {
  ProfessionalProfileAdminDetail,
  ProfessionalProfileAdminEntry,
  ProfessionalProfileAdminSection,
  ProfessionalProfileAnalytics,
  ProfessionalProfileCard,
  ProfessionalProfileListFilters,
  ProfessionalProfileListItem,
  ProfessionalProfileListResult,
  ProfessionalProfileLocalization,
  ProfessionalProfileStatus,
  ProfileCampaign,
  ProfileContentSourceType,
  ProfileEventSource,
  ProfileEventType,
  ProfileLocale,
  ProfileSectionKey,
} from "@/lib/profiles/types";
import {
  PROFILE_EVENT_SOURCES,
  PROFILE_EVENT_TYPES,
  PROFILE_SECTION_KEYS,
} from "@/lib/profiles/types";
import type { ProfileUpdateInput } from "@/lib/profiles/validation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export class ProfileHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProfileHttpError";
  }
}

/**
 * Traduz erro do domínio em resposta HTTP com código estável.
 * Erro inesperado nunca vaza mensagem interna — nem valor de contato privado.
 */
export function toProfileApiError(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof ProfileHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  return {
    status: 500,
    body: { error: "Ocorreu um erro inesperado.", code: "PROFILE_INTERNAL_ERROR" },
  };
}

export function createProfileAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new ProfileHttpError(
      "SUPABASE_SERVICE_ROLE_KEY não configurada.",
      503,
      "PROFILE_SERVICE_UNAVAILABLE"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// ---------------------------------------------------------------------------
// Autorização (pura)
// ---------------------------------------------------------------------------

/**
 * Só o papel `admin` administra perfis. Ter `/nfc` — ou mesmo `/admin` na
 * lista de permissões de seção — não basta: perfis expõem dado pessoal de
 * colaborador, então a régua é a mesma das policies do banco.
 */
export function assertProfileAdminRole(profile: {
  role: string | null | undefined;
  permissions?: string[] | null;
}): void {
  const role = (profile.role ?? "").trim().toLowerCase();
  if (role !== "admin") {
    throw new ProfileHttpError(
      "Apenas administradores podem gerenciar perfis profissionais.",
      403,
      "PROFILE_FORBIDDEN"
    );
  }
}

// ---------------------------------------------------------------------------
// Checklist de publicação (puro)
// ---------------------------------------------------------------------------

/** Campos exigidos para publicar. OAB permanece opcional de propósito. */
export const PUBLISH_REQUIREMENTS = [
  "slug",
  "photo",
  "displayName",
  "role",
  "practiceArea",
  "tagline",
  "bio",
  "professionalEmail",
  "contactAction",
] as const;

export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

export const PUBLISH_REQUIREMENT_LABELS: Record<PublishRequirement, string> = {
  slug: "Endereço público (slug)",
  photo: "Foto profissional",
  displayName: "Nome público em português",
  role: "Cargo em português",
  practiceArea: "Área de atuação em português",
  tagline: "Frase de posicionamento em português",
  bio: "Mini-CV em português",
  professionalEmail: "E-mail institucional",
  contactAction: "Ao menos uma ação de contato habilitada",
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function findLocalization(
  localizations: ProfessionalProfileLocalization[],
  locale: ProfileLocale
): ProfessionalProfileLocalization | null {
  return localizations.find((item) => item.locale === locale) ?? null;
}

/** Requisitos de publicação que ainda faltam. Lista vazia = pode publicar. */
export function listMissingPublishRequirements(
  detail: ProfessionalProfileAdminDetail
): PublishRequirement[] {
  const pt = findLocalization(detail.localizations, "pt-BR");
  const missing: PublishRequirement[] = [];

  if (!hasText(detail.slug)) missing.push("slug");
  if (!hasText(detail.photoUrl)) missing.push("photo");
  if (!hasText(pt?.displayName)) missing.push("displayName");
  if (!hasText(pt?.role)) missing.push("role");
  if (!hasText(pt?.practiceArea)) missing.push("practiceArea");
  if (!hasText(pt?.tagline)) missing.push("tagline");
  if (!hasText(pt?.bio)) missing.push("bio");
  if (!hasText(detail.professionalEmail)) missing.push("professionalEmail");

  const hasContactAction =
    (detail.showEmail && hasText(detail.professionalEmail)) ||
    (detail.showWhatsapp && hasText(detail.professionalPhone)) ||
    (detail.showLinkedin && hasText(detail.linkedinUrl)) ||
    (detail.showWebsite && hasText(detail.websiteUrl));
  if (!hasContactAction) missing.push("contactAction");

  return missing;
}

/** Percentual de preenchimento (0..100) usado no painel administrativo. */
export function computeProfileCompleteness(detail: ProfessionalProfileAdminDetail): number {
  const total = PUBLISH_REQUIREMENTS.length;
  const missing = listMissingPublishRequirements(detail).length;
  const filled = Math.max(0, total - missing);
  return Math.round((filled / total) * 100);
}

// ---------------------------------------------------------------------------
// Plano de save (puro)
// ---------------------------------------------------------------------------

export interface ProfileSavePlan {
  profilePatch: Partial<{
    slug: string;
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
  }> & { slug?: string };
  /** Slug antigo que precisa virar redirect permanente, ou null. */
  slugRedirectToInsert: string | null;
  canPublish: boolean;
  missingForPublish: PublishRequirement[];
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === undefined) return undefined as unknown as string | null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Monta o patch do perfil e decide se o slug anterior vira redirect.
 * Trocar o slug sem redirect quebraria cartões NFC já entregues.
 */
export function buildProfileSavePlan(
  current: ProfessionalProfileAdminDetail,
  input: ProfileUpdateInput
): ProfileSavePlan {
  const patch: ProfileSavePlan["profilePatch"] = {};

  if (input.slug !== undefined && input.slug !== current.slug) {
    patch.slug = input.slug;
  }
  if (input.photoUrl !== undefined) patch.photo_url = normalizeNullable(input.photoUrl);
  if (input.oab !== undefined) patch.oab = normalizeNullable(input.oab);
  if (input.joinedOn !== undefined) patch.joined_on = normalizeNullable(input.joinedOn);
  if (input.professionalEmail !== undefined) {
    patch.professional_email = normalizeNullable(input.professionalEmail);
  }
  if (input.professionalPhone !== undefined) {
    patch.professional_phone = normalizeNullable(input.professionalPhone);
  }
  if (input.linkedinUrl !== undefined) patch.linkedin_url = normalizeNullable(input.linkedinUrl);
  if (input.websiteUrl !== undefined) patch.website_url = normalizeNullable(input.websiteUrl);
  if (input.showTenure !== undefined) patch.show_tenure = input.showTenure;
  if (input.showEmail !== undefined) patch.show_email = input.showEmail;
  if (input.showWhatsapp !== undefined) patch.show_whatsapp = input.showWhatsapp;
  if (input.showLinkedin !== undefined) patch.show_linkedin = input.showLinkedin;
  if (input.showWebsite !== undefined) patch.show_website = input.showWebsite;

  const slugChanged = Boolean(patch.slug) && Boolean(current.slug);
  const missingForPublish = listMissingPublishRequirements(current);

  return {
    profilePatch: patch,
    slugRedirectToInsert: slugChanged ? current.slug : null,
    canPublish: missingForPublish.length === 0,
    missingForPublish,
  };
}

/**
 * Aplica um payload parcial de localização sobre o registro atual.
 * Campo ausente permanece como está; `null` explícito limpa o campo — assim
 * salvar a aba PT nunca apaga o que já foi traduzido em EN, e vice-versa.
 */
export function mergeLocalizationForSave(
  current: ProfessionalProfileLocalization | null,
  input: {
    locale: ProfileLocale | string;
    isApproved?: boolean;
    displayName?: string | null;
    role?: string | null;
    practiceArea?: string | null;
    tagline?: string | null;
    bio?: string | null;
  }
): ProfessionalProfileLocalization {
  const base: ProfessionalProfileLocalization = current ?? {
    locale: input.locale as ProfileLocale,
    // Tradução recém-criada nunca nasce aprovada: publicar EN é ato explícito.
    isApproved: false,
    displayName: null,
    role: null,
    practiceArea: null,
    tagline: null,
    bio: null,
  };

  const pick = (
    incoming: string | null | undefined,
    fallback: string | null
  ): string | null => {
    if (incoming === undefined) return fallback;
    if (incoming === null) return null;
    const trimmed = incoming.trim();
    return trimmed ? trimmed : null;
  };

  return {
    locale: base.locale,
    isApproved: input.isApproved ?? base.isApproved,
    displayName: pick(input.displayName, base.displayName),
    role: pick(input.role, base.role),
    practiceArea: pick(input.practiceArea, base.practiceArea),
    tagline: pick(input.tagline, base.tagline),
    bio: pick(input.bio, base.bio),
  };
}

// ---------------------------------------------------------------------------
// Filtros da listagem (puro)
// ---------------------------------------------------------------------------

function searchKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matchesProfileListFilters(
  item: ProfessionalProfileListItem,
  filters: ProfessionalProfileListFilters
): boolean {
  if (filters.status && filters.status !== "all" && item.status !== filters.status) {
    return false;
  }

  if (filters.completeness && filters.completeness !== "all") {
    const isComplete = item.completeness >= 100;
    if (filters.completeness === "complete" && !isComplete) return false;
    if (filters.completeness === "incomplete" && isComplete) return false;
  }

  const query = searchKey(filters.search).trim();
  if (query) {
    const haystack = [item.displayName, item.role, item.practiceArea, item.slug]
      .map(searchKey)
      .join(" ");
    if (!haystack.includes(query)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Mapeamento de linhas do banco
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const PROFILE_COLUMNS =
  "id, user_id, slug, status, photo_url, oab, joined_on, professional_email, " +
  "professional_phone, linkedin_url, website_url, show_tenure, show_email, " +
  "show_whatsapp, show_linkedin, show_website, published_at, updated_at";

const LOCALIZATION_COLUMNS =
  "profile_id, locale, is_approved, display_name, role, practice_area, tagline, bio";

function mapLocalization(row: Row): ProfessionalProfileLocalization {
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

function mapCard(row: Row): ProfessionalProfileCard {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    nfcTagId: (row.nfc_tag_id as string | null) ?? null,
    code: row.code as string,
    label: row.label as string,
    status: row.status as ProfessionalProfileCard["status"],
    replacedCardId: (row.replaced_card_id as string | null) ?? null,
    issuedAt: (row.issued_at as string | null) ?? null,
    activatedAt: (row.activated_at as string | null) ?? null,
    retiredAt: (row.retired_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapProfileBase(row: Row): Omit<
  ProfessionalProfileAdminDetail,
  "userName" | "localizations" | "sections" | "cards" | "hiddenContentKeys"
> {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    slug: row.slug as string,
    status: row.status as ProfessionalProfileStatus,
    photoUrl: (row.photo_url as string | null) ?? null,
    oab: (row.oab as string | null) ?? null,
    joinedOn: (row.joined_on as string | null) ?? null,
    professionalEmail: (row.professional_email as string | null) ?? null,
    professionalPhone: (row.professional_phone as string | null) ?? null,
    linkedinUrl: (row.linkedin_url as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    showTenure: Boolean(row.show_tenure),
    showEmail: Boolean(row.show_email),
    showWhatsapp: Boolean(row.show_whatsapp),
    showLinkedin: Boolean(row.show_linkedin),
    showWebsite: Boolean(row.show_website),
    publishedAt: (row.published_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Operações de repositório
// ---------------------------------------------------------------------------

export async function listProfessionalProfiles(
  filters: ProfessionalProfileListFilters = {}
): Promise<ProfessionalProfileListResult> {
  const db = createProfileAdminClient();

  const [{ data: profileRows, error: profileError }, { data: localizationRows }, { data: cardRows }] =
    await Promise.all([
      db.from("professional_profiles").select(PROFILE_COLUMNS).order("updated_at", { ascending: false }),
      db.from("professional_profile_localizations").select(LOCALIZATION_COLUMNS),
      db.from("professional_profile_cards").select("id, profile_id, status"),
    ]);

  if (profileError) {
    throw new ProfileHttpError(
      "Não foi possível listar os perfis.",
      500,
      "PROFILE_LIST_FAILED"
    );
  }

  const localizationsByProfile = new Map<string, ProfessionalProfileLocalization[]>();
  for (const row of (localizationRows ?? []) as Row[]) {
    const profileId = row.profile_id as string;
    const list = localizationsByProfile.get(profileId) ?? [];
    list.push(mapLocalization(row));
    localizationsByProfile.set(profileId, list);
  }

  const cardsByProfile = new Map<string, { total: number; active: number }>();
  const cardStatusCounts = { pending: 0, active: 0, replaced: 0, inactive: 0 };
  for (const row of (cardRows ?? []) as Row[]) {
    const profileId = row.profile_id as string;
    const entry = cardsByProfile.get(profileId) ?? { total: 0, active: 0 };
    entry.total += 1;
    const status = row.status as keyof typeof cardStatusCounts;
    if (status in cardStatusCounts) cardStatusCounts[status] += 1;
    if (status === "active") entry.active += 1;
    cardsByProfile.set(profileId, entry);
  }

  const summary = {
    total: 0,
    draft: 0,
    published: 0,
    archived: 0,
    incomplete: 0,
    cardsPending: cardStatusCounts.pending,
    cardsActive: cardStatusCounts.active,
    cardsReplaced: cardStatusCounts.replaced,
    cardsInactive: cardStatusCounts.inactive,
  };

  const items: ProfessionalProfileListItem[] = [];
  for (const row of (profileRows ?? []) as unknown as Row[]) {
    const base = mapProfileBase(row);
    const localizations = localizationsByProfile.get(base.id) ?? [];
    const pt = findLocalization(localizations, "pt-BR");
    const en = findLocalization(localizations, "en");
    const cards = cardsByProfile.get(base.id) ?? { total: 0, active: 0 };

    const detailForScore: ProfessionalProfileAdminDetail = {
      ...base,
      userName: null,
      localizations,
      sections: [],
      cards: [],
      hiddenContentKeys: [],
    };
    const completeness = computeProfileCompleteness(detailForScore);

    summary.total += 1;
    summary[base.status] += 1;
    if (completeness < 100) summary.incomplete += 1;

    items.push({
      id: base.id,
      userId: base.userId,
      slug: base.slug,
      status: base.status,
      photoUrl: base.photoUrl,
      displayName: pt?.displayName ?? null,
      role: pt?.role ?? null,
      practiceArea: pt?.practiceArea ?? null,
      completeness,
      hasApprovedEnglish: Boolean(en?.isApproved),
      cardCount: cards.total,
      activeCardCount: cards.active,
      viewCount: 0,
      scanCount: 0,
      updatedAt: base.updatedAt,
    });
  }

  const filtered = items.filter((item) => matchesProfileListFilters(item, filters));
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? filtered.length;

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    summary,
  };
}

export async function getProfessionalProfileAdmin(
  id: string
): Promise<ProfessionalProfileAdminDetail> {
  const db = createProfileAdminClient();

  const { data: profileRow, error } = await db
    .from("professional_profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ProfileHttpError("Não foi possível carregar o perfil.", 500, "PROFILE_LOAD_FAILED");
  }
  if (!profileRow) {
    throw new ProfileHttpError("Perfil não encontrado.", 404, "PROFILE_NOT_FOUND");
  }

  const base = mapProfileBase(profileRow as unknown as Row);

  const [
    { data: localizationRows },
    { data: sectionRows },
    { data: cardRows },
    { data: overrideRows },
    { data: userRow },
  ] = await Promise.all([
    db.from("professional_profile_localizations").select(LOCALIZATION_COLUMNS).eq("profile_id", id),
    db
      .from("professional_profile_sections")
      .select("id, profile_id, section_key, enabled, sort_order")
      .eq("profile_id", id)
      .order("sort_order"),
    db
      .from("professional_profile_cards")
      .select(
        "id, profile_id, nfc_tag_id, code, label, status, replaced_card_id, issued_at, activated_at, retired_at, created_at"
      )
      .eq("profile_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("professional_profile_content_overrides")
      .select("source_type, source_id, is_hidden")
      .eq("profile_id", id),
    db.from("users").select("name").eq("id", base.userId).maybeSingle(),
  ]);

  const sectionIds = ((sectionRows ?? []) as Row[]).map((row) => row.id as string);
  const entriesBySection = new Map<string, ProfessionalProfileAdminEntry[]>();

  if (sectionIds.length > 0) {
    const { data: entryRows } = await db
      .from("professional_profile_entries")
      .select("id, section_id, entry_type, link_url, image_url, occurred_on, metadata, sort_order, is_visible")
      .in("section_id", sectionIds)
      .order("sort_order");

    const entryIds = ((entryRows ?? []) as Row[]).map((row) => row.id as string);
    const entryLocalizations = new Map<string, ProfessionalProfileAdminEntry["localizations"]>();

    if (entryIds.length > 0) {
      const { data: entryLocalizationRows } = await db
        .from("professional_profile_entry_localizations")
        .select("entry_id, locale, title, subtitle, description")
        .in("entry_id", entryIds);

      for (const row of (entryLocalizationRows ?? []) as Row[]) {
        const entryId = row.entry_id as string;
        const list = entryLocalizations.get(entryId) ?? [];
        list.push({
          locale: row.locale as ProfileLocale,
          title: row.title as string,
          subtitle: (row.subtitle as string | null) ?? null,
          description: (row.description as string | null) ?? null,
        });
        entryLocalizations.set(entryId, list);
      }
    }

    for (const row of (entryRows ?? []) as Row[]) {
      const sectionId = row.section_id as string;
      const list = entriesBySection.get(sectionId) ?? [];
      list.push({
        id: row.id as string,
        entryType: row.entry_type as string,
        linkUrl: (row.link_url as string | null) ?? null,
        imageUrl: (row.image_url as string | null) ?? null,
        occurredOn: (row.occurred_on as string | null) ?? null,
        metadata: (row.metadata as Record<string, unknown> | null) ?? {},
        sortOrder: (row.sort_order as number | null) ?? 0,
        isVisible: Boolean(row.is_visible),
        localizations: entryLocalizations.get(row.id as string) ?? [],
      });
      entriesBySection.set(sectionId, list);
    }
  }

  const sections: ProfessionalProfileAdminSection[] = ((sectionRows ?? []) as Row[]).map((row) => ({
    id: row.id as string,
    key: row.section_key as ProfileSectionKey,
    enabled: Boolean(row.enabled),
    sortOrder: (row.sort_order as number | null) ?? 0,
    entries: entriesBySection.get(row.id as string) ?? [],
  }));

  const hiddenContentKeys = ((overrideRows ?? []) as Row[])
    .filter((row) => Boolean(row.is_hidden))
    .map((row) => `${row.source_type as string}:${row.source_id as string}`);

  return {
    ...base,
    userName: ((userRow as Row | null)?.name as string | null) ?? null,
    localizations: ((localizationRows ?? []) as Row[]).map(mapLocalization),
    sections,
    cards: ((cardRows ?? []) as Row[]).map(mapCard),
    hiddenContentKeys,
  };
}

export async function saveProfessionalProfile(
  id: string,
  input: ProfileUpdateInput,
  actorId: string
): Promise<ProfessionalProfileAdminDetail> {
  const db = createProfileAdminClient();
  const current = await getProfessionalProfileAdmin(id);
  const plan = buildProfileSavePlan(current, input);

  if (plan.slugRedirectToInsert) {
    // O slug antigo precisa continuar resolvendo: cartões já entregues apontam
    // para ele. Guardamos o redirect antes de trocar o slug.
    const { error: redirectError } = await db
      .from("professional_profile_slug_redirects")
      .upsert(
        { profile_id: id, old_slug: plan.slugRedirectToInsert },
        { onConflict: "old_slug", ignoreDuplicates: true }
      );
    if (redirectError) {
      throw new ProfileHttpError(
        "Não foi possível preservar o endereço anterior do perfil.",
        500,
        "PROFILE_SAVE_FAILED"
      );
    }
  }

  if (Object.keys(plan.profilePatch).length > 0) {
    const { error } = await db
      .from("professional_profiles")
      .update({ ...plan.profilePatch, updated_by: actorId })
      .eq("id", id);
    if (error) {
      const isSlugConflict = /duplicate key|unique/i.test(error.message ?? "");
      throw new ProfileHttpError(
        isSlugConflict ? "Este endereço público já está em uso." : "Não foi possível salvar o perfil.",
        isSlugConflict ? 409 : 500,
        isSlugConflict ? "PROFILE_SLUG_TAKEN" : "PROFILE_SAVE_FAILED"
      );
    }
  }

  for (const localizationInput of input.localizations ?? []) {
    const existing = findLocalization(current.localizations, localizationInput.locale as ProfileLocale);
    const merged = mergeLocalizationForSave(existing, localizationInput);
    const { error } = await db.from("professional_profile_localizations").upsert(
      {
        profile_id: id,
        locale: merged.locale,
        is_approved: merged.isApproved,
        display_name: merged.displayName,
        role: merged.role,
        practice_area: merged.practiceArea,
        tagline: merged.tagline,
        bio: merged.bio,
      },
      { onConflict: "profile_id,locale" }
    );
    if (error) {
      throw new ProfileHttpError(
        "Não foi possível salvar a tradução do perfil.",
        500,
        "PROFILE_SAVE_FAILED"
      );
    }
  }

  for (const sectionInput of input.sections ?? []) {
    const existingSection = current.sections.find((section) => section.key === sectionInput.key);
    const { data: sectionRow, error: sectionError } = await db
      .from("professional_profile_sections")
      .upsert(
        {
          profile_id: id,
          section_key: sectionInput.key,
          enabled: sectionInput.enabled ?? existingSection?.enabled ?? true,
          sort_order: sectionInput.sortOrder ?? existingSection?.sortOrder ?? 0,
        },
        { onConflict: "profile_id,section_key" }
      )
      .select("id")
      .maybeSingle();

    if (sectionError || !sectionRow) {
      throw new ProfileHttpError(
        "Não foi possível salvar as seções do perfil.",
        500,
        "PROFILE_SAVE_FAILED"
      );
    }

    const sectionId = (sectionRow as Row).id as string;

    for (const entryId of sectionInput.deletedEntryIds ?? []) {
      await db.from("professional_profile_entries").delete().eq("id", entryId).eq("section_id", sectionId);
    }

    for (const [index, entryInput] of (sectionInput.entries ?? []).entries()) {
      const entryPayload = {
        section_id: sectionId,
        entry_type: entryInput.entryType,
        link_url: entryInput.linkUrl || null,
        image_url: entryInput.imageUrl || null,
        occurred_on: entryInput.occurredOn || null,
        metadata: entryInput.metadata ?? {},
        sort_order: entryInput.sortOrder ?? index,
        is_visible: entryInput.isVisible ?? true,
      };

      let entryId = entryInput.id ?? null;
      if (entryId) {
        const { error } = await db
          .from("professional_profile_entries")
          .update(entryPayload)
          .eq("id", entryId);
        if (error) {
          throw new ProfileHttpError(
            "Não foi possível salvar um item do perfil.",
            500,
            "PROFILE_SAVE_FAILED"
          );
        }
      } else {
        const { data: inserted, error } = await db
          .from("professional_profile_entries")
          .insert(entryPayload)
          .select("id")
          .maybeSingle();
        if (error || !inserted) {
          throw new ProfileHttpError(
            "Não foi possível criar um item do perfil.",
            500,
            "PROFILE_SAVE_FAILED"
          );
        }
        entryId = (inserted as Row).id as string;
      }

      for (const entryLocalization of entryInput.localizations ?? []) {
        await db.from("professional_profile_entry_localizations").upsert(
          {
            entry_id: entryId,
            locale: entryLocalization.locale,
            title: entryLocalization.title,
            subtitle: entryLocalization.subtitle ?? null,
            description: entryLocalization.description ?? null,
          },
          { onConflict: "entry_id,locale" }
        );
      }
    }
  }

  return getProfessionalProfileAdmin(id);
}

export async function setProfessionalProfileStatus(
  id: string,
  status: ProfessionalProfileStatus,
  actorId: string
): Promise<void> {
  const db = createProfileAdminClient();

  if (status === "published") {
    const detail = await getProfessionalProfileAdmin(id);
    const missing = listMissingPublishRequirements(detail);
    if (missing.length > 0) {
      throw new ProfileHttpError(
        `Complete o perfil antes de publicar: ${missing
          .map((key) => PUBLISH_REQUIREMENT_LABELS[key])
          .join(", ")}.`,
        400,
        "PROFILE_INCOMPLETE"
      );
    }
  }

  // Despublicar volta para rascunho sem apagar cartões, redirects ou eventos.
  const { error } = await db
    .from("professional_profiles")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_by: actorId,
    })
    .eq("id", id);

  if (error) {
    throw new ProfileHttpError(
      "Não foi possível alterar a publicação do perfil.",
      500,
      "PROFILE_STATUS_FAILED"
    );
  }
}

export async function setContentOverride(
  profileId: string,
  sourceType: ProfileContentSourceType,
  sourceId: string,
  hidden: boolean
): Promise<void> {
  const db = createProfileAdminClient();
  // Só a tabela de override muda: a publicação original nunca é tocada.
  const { error } = await db.from("professional_profile_content_overrides").upsert(
    { profile_id: profileId, source_type: sourceType, source_id: sourceId, is_hidden: hidden },
    { onConflict: "profile_id,source_type,source_id" }
  );
  if (error) {
    throw new ProfileHttpError(
      "Não foi possível atualizar a visibilidade do conteúdo.",
      500,
      "PROFILE_OVERRIDE_FAILED"
    );
  }
}

export async function getProfessionalProfileAnalytics(
  profileId: string,
  range: { from: Date; to: Date }
): Promise<ProfessionalProfileAnalytics> {
  const db = createProfileAdminClient();

  const { data: eventRows, error } = await db
    .from("professional_profile_events")
    .select("event_type, source, card_id, occurred_at")
    .eq("profile_id", profileId)
    .gte("occurred_at", range.from.toISOString())
    .lte("occurred_at", range.to.toISOString());

  if (error) {
    throw new ProfileHttpError(
      "Não foi possível carregar as métricas do perfil.",
      500,
      "PROFILE_ANALYTICS_FAILED"
    );
  }

  const totals = Object.fromEntries(
    PROFILE_EVENT_TYPES.map((type) => [type, 0])
  ) as Record<ProfileEventType, number>;
  const bySource = Object.fromEntries(
    PROFILE_EVENT_SOURCES.map((source) => [source, 0])
  ) as Record<ProfileEventSource, number>;
  const dailyMap = new Map<string, { views: number; scans: number }>();
  const cardScans = new Map<string, number>();

  for (const row of (eventRows ?? []) as Row[]) {
    const eventType = row.event_type as ProfileEventType;
    const source = row.source as ProfileEventSource;
    if (eventType in totals) totals[eventType] += 1;
    if (source in bySource) bySource[source] += 1;

    const day = String(row.occurred_at ?? "").slice(0, 10);
    if (day) {
      const entry = dailyMap.get(day) ?? { views: 0, scans: 0 };
      if (eventType === "profile_view") entry.views += 1;
      if (eventType === "nfc_scan" || eventType === "qr_scan") entry.scans += 1;
      dailyMap.set(day, entry);
    }

    const cardId = row.card_id as string | null;
    if (cardId && (eventType === "nfc_scan" || eventType === "qr_scan")) {
      cardScans.set(cardId, (cardScans.get(cardId) ?? 0) + 1);
    }
  }

  let byCard: ProfessionalProfileAnalytics["byCard"] = [];
  if (cardScans.size > 0) {
    const { data: cardRows } = await db
      .from("professional_profile_cards")
      .select("id, code, label")
      .in("id", Array.from(cardScans.keys()));
    byCard = ((cardRows ?? []) as Row[]).map((row) => ({
      cardId: row.id as string,
      code: row.code as string,
      label: row.label as string,
      scans: cardScans.get(row.id as string) ?? 0,
    }));
  }

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals,
    bySource,
    daily: Array.from(dailyMap.entries())
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byCard,
  };
}

// ---------------------------------------------------------------------------
// Campanha
// ---------------------------------------------------------------------------

export async function getProfileCampaign(): Promise<ProfileCampaign | null> {
  const db = createProfileAdminClient();
  const { data, error } = await db
    .from("professional_profile_campaign")
    .select(
      "enabled, starts_at, ends_at, title_pt, title_en, message_pt, message_en, call_to_action_pt, call_to_action_en"
    )
    .eq("id", true)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Row;
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

export async function saveProfileCampaign(
  input: ProfileCampaign,
  actorId: string
): Promise<void> {
  const db = createProfileAdminClient();
  const { error } = await db
    .from("professional_profile_campaign")
    .update({
      enabled: input.enabled,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      title_pt: input.titlePt,
      title_en: input.titleEn,
      message_pt: input.messagePt,
      message_en: input.messageEn,
      call_to_action_pt: input.callToActionPt,
      call_to_action_en: input.callToActionEn,
      updated_by: actorId,
    })
    .eq("id", true);

  if (error) {
    throw new ProfileHttpError(
      "Não foi possível salvar a campanha.",
      500,
      "PROFILE_CAMPAIGN_FAILED"
    );
  }
}

/** Conjunto de slugs já ocupados (perfis + redirects), para sugerir um livre. */
export async function suggestAvailableSlug(name: string): Promise<string> {
  const db = createProfileAdminClient();
  const base = makeProfileSlug(name) || "perfil";
  const [{ data: profiles }, { data: redirects }] = await Promise.all([
    db.from("professional_profiles").select("slug"),
    db.from("professional_profile_slug_redirects").select("old_slug"),
  ]);
  const taken = new Set<string>([
    ...((profiles ?? []) as Row[]).map((row) => row.slug as string),
    ...((redirects ?? []) as Row[]).map((row) => row.old_slug as string),
  ]);
  return nextProfileSlugCandidate(base, taken);
}

export { PROFILE_SECTION_KEYS };
