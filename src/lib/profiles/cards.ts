/**
 * Cartões NFC/QR vinculados a perfis profissionais.
 *
 * Regras:
 * - rascunho pode ser vinculado como pending, mas só perfil publicado ativa;
 * - substituir um cartão aposenta o anterior e preserva histórico via replaced_card_id;
 * - cartões inactive/replaced não redirecionam;
 * - resolução pública nunca expõe campos privados do perfil.
 */

import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProfileHttpError,
  createProfileAdminClient,
} from "@/lib/profiles/admin";
import { getNfcPublicUrl, type NfcScanSource } from "@/lib/nfc/public-url";
import { generatePublicToken } from "@/lib/nfc/security";
import type { NfcPublicResolution } from "@/lib/nfc/types";
import type {
  ProfessionalProfileCard,
  ProfessionalProfileCardView,
  ProfessionalProfileStatus,
  ProfileCardStatus,
  ProfileLocale,
} from "@/lib/profiles/types";

type Row = Record<string, unknown>;

export interface CreateProfileCardInput {
  label: string;
  nfcTagId?: string | null;
  /** Se informado, aposenta esse cartão como `replaced` e aponta o novo para ele. */
  replaceCardId?: string | null;
}

export interface ProfessionalProfilePublicHint {
  id: string;
  slug: string;
  status: ProfessionalProfileStatus;
  displayName: string;
  locale: ProfileLocale;
  /** Campos privados — usados só para garantir que a projeção pública os exclua. */
  professionalEmail?: string | null;
  professionalPhone?: string | null;
  oab?: string | null;
  linkedinUrl?: string | null;
}

const CARD_COLUMNS =
  "id, profile_id, nfc_tag_id, code, label, status, replaced_card_id, issued_at, activated_at, retired_at, created_at, physically_activated_at";

function mapCard(row: Row): ProfessionalProfileCard {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    nfcTagId: (row.nfc_tag_id as string | null) ?? null,
    code: row.code as string,
    label: row.label as string,
    status: row.status as ProfileCardStatus,
    replacedCardId: (row.replaced_card_id as string | null) ?? null,
    issuedAt: (row.issued_at as string | null) ?? null,
    activatedAt: (row.activated_at as string | null) ?? null,
    retiredAt: (row.retired_at as string | null) ?? null,
    createdAt: row.created_at as string,
    physicallyActivatedAt: (row.physically_activated_at as string | null) ?? null,
  };
}

export function nextProfileCardCode(existingCodes: string[]): string {
  const largest = existingCodes.reduce((max, code) => {
    const match = /^PPC-(\d+)$/.exec(code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `PPC-${String(largest + 1).padStart(4, "0")}`;
}

export function assertCanActivateProfileCard(
  profileStatus: ProfessionalProfileStatus
): void {
  if (profileStatus !== "published") {
    throw new ProfileHttpError(
      "Somente perfis publicados podem ativar um cartão NFC.",
      400,
      "PROFILE_CARD_NOT_PUBLISHED"
    );
  }
}

export function canRedirectProfileCard(status: ProfileCardStatus): boolean {
  return status === "active" || status === "pending";
}

export function buildProfessionalProfilePublicAction(
  profile: ProfessionalProfilePublicHint
): NonNullable<NfcPublicResolution["action"]> {
  return {
    type: "professional_profile",
    requiresConfirmation: false,
    loadingMessage: `Abrindo o perfil de ${profile.displayName}`,
    profile: {
      slug: profile.slug,
      displayName: profile.displayName,
      locale: profile.locale,
    },
  };
}

export function buildProfileRedirectPath(
  slug: string,
  source: NfcScanSource
): string {
  return `/perfil/${encodeURIComponent(slug)}?source=${source}`;
}

async function nextCardCode(db: SupabaseClient): Promise<string> {
  const { data } = await db
    .from("professional_profile_cards")
    .select("code")
    .like("code", "PPC-%")
    .order("created_at", { ascending: false })
    .limit(500);
  return nextProfileCardCode(((data ?? []) as Row[]).map((row) => String(row.code)));
}

async function nextNfcCode(db: SupabaseClient): Promise<string> {
  const { data } = await db
    .from("nfc_tags")
    .select("code")
    .like("code", "NFC-%")
    .order("created_at", { ascending: false })
    .limit(500);
  const largest = ((data ?? []) as Row[]).reduce((max, row) => {
    const match = /^NFC-(\d+)$/.exec(String(row.code));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `NFC-${String(largest + 1).padStart(4, "0")}`;
}

async function loadProfileStatus(
  db: SupabaseClient,
  profileId: string
): Promise<{ status: ProfessionalProfileStatus; slug: string; displayName: string }> {
  const { data: profile, error } = await db
    .from("professional_profiles")
    .select("id, slug, status")
    .eq("id", profileId)
    .maybeSingle();
  if (error) {
    throw new ProfileHttpError("Não foi possível carregar o perfil.", 500, "PROFILE_LOAD_FAILED");
  }
  if (!profile) {
    throw new ProfileHttpError("Perfil não encontrado.", 404, "PROFILE_NOT_FOUND");
  }

  const { data: localization } = await db
    .from("professional_profile_localizations")
    .select("display_name")
    .eq("profile_id", profileId)
    .eq("locale", "pt-BR")
    .maybeSingle();

  return {
    status: profile.status as ProfessionalProfileStatus,
    slug: String(profile.slug),
    displayName:
      (localization?.display_name as string | null | undefined)?.trim() ||
      String(profile.slug),
  };
}

async function createLinkedNfcTag(
  db: SupabaseClient,
  profileId: string,
  label: string,
  actorId: string
): Promise<{ id: string; code: string; publicToken: string }> {
  const profile = await loadProfileStatus(db, profileId);
  const code = await nextNfcCode(db);
  let created: Row | null = null;

  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    const { data, error } = await db
      .from("nfc_tags")
      .insert({
        code,
        public_token: generatePublicToken(),
        name: label.trim() || `Perfil — ${profile.displayName}`,
        description: `Cartão NFC do perfil ${profile.displayName}`,
        environment: "Material comercial",
        category: "Perfil profissional",
        status: "active",
        access_mode: "public",
        action_type: "professional_profile",
        action_config: { profileId },
        cooldown_seconds: 0,
        created_by: actorId,
      })
      .select("id, code, public_token")
      .single();
    if (!error) created = data as Row;
    else if (error.code !== "23505") {
      throw new ProfileHttpError(
        "Não foi possível criar a etiqueta NFC do cartão.",
        500,
        "PROFILE_CARD_TAG_CREATE_FAILED"
      );
    }
  }

  if (!created) {
    throw new ProfileHttpError(
      "Não foi possível gerar um token NFC único.",
      409,
      "PROFILE_CARD_TOKEN_COLLISION"
    );
  }

  return {
    id: created.id as string,
    code: created.code as string,
    publicToken: created.public_token as string,
  };
}

export async function listProfileCards(
  profileId: string
): Promise<ProfessionalProfileCardView[]> {
  const db = createProfileAdminClient();
  const { data, error } = await db
    .from("professional_profile_cards")
    .select(
      `${CARD_COLUMNS}, nfc_tags ( code, public_token )`
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProfileHttpError(
      "Não foi possível carregar os cartões.",
      500,
      "PROFILE_CARDS_LIST_FAILED"
    );
  }

  return ((data ?? []) as Row[]).map((row) => {
    const tag = (row.nfc_tags as Row | Row[] | null | undefined) ?? null;
    const tagRow = Array.isArray(tag) ? tag[0] : tag;
    return {
      ...mapCard(row),
      nfcTagCode: tagRow?.code ? String(tagRow.code) : null,
      nfcPublicToken: tagRow?.public_token ? String(tagRow.public_token) : null,
    };
  });
}

export async function createProfileCard(
  profileId: string,
  input: CreateProfileCardInput,
  actorId: string
): Promise<ProfessionalProfileCard> {
  const db = createProfileAdminClient();
  const label = input.label?.trim();
  if (!label) {
    throw new ProfileHttpError("Informe o rótulo do cartão.", 400, "PROFILE_CARD_INVALID");
  }

  await loadProfileStatus(db, profileId);

  let nfcTagId = input.nfcTagId ?? null;
  if (nfcTagId) {
    const { data: tag, error } = await db
      .from("nfc_tags")
      .select("id, action_type, action_config")
      .eq("id", nfcTagId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !tag) {
      throw new ProfileHttpError("Etiqueta NFC não encontrada.", 404, "PROFILE_CARD_TAG_NOT_FOUND");
    }
    const { error: updateError } = await db
      .from("nfc_tags")
      .update({
        action_type: "professional_profile",
        action_config: { profileId },
        name: label,
      })
      .eq("id", nfcTagId);
    if (updateError) {
      throw new ProfileHttpError(
        "Não foi possível vincular a etiqueta ao perfil.",
        500,
        "PROFILE_CARD_TAG_LINK_FAILED"
      );
    }
  } else {
    const createdTag = await createLinkedNfcTag(db, profileId, label, actorId);
    nfcTagId = createdTag.id;
  }

  const replaceCardId = input.replaceCardId ?? null;
  if (replaceCardId) {
    const { data: previous, error } = await db
      .from("professional_profile_cards")
      .select(CARD_COLUMNS)
      .eq("id", replaceCardId)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error || !previous) {
      throw new ProfileHttpError(
        "Cartão a substituir não encontrado.",
        404,
        "PROFILE_CARD_REPLACE_NOT_FOUND"
      );
    }
    const previousStatus = previous.status as ProfileCardStatus;
    if (previousStatus === "replaced" || previousStatus === "inactive") {
      throw new ProfileHttpError(
        "Só é possível substituir um cartão ativo ou pendente.",
        400,
        "PROFILE_CARD_REPLACE_INVALID"
      );
    }
  }

  const now = new Date().toISOString();
  const code = await nextCardCode(db);

  const { data: created, error: createError } = await db
    .from("professional_profile_cards")
    .insert({
      profile_id: profileId,
      nfc_tag_id: nfcTagId,
      code,
      label,
      status: "pending",
      replaced_card_id: replaceCardId,
      issued_at: now,
    })
    .select(CARD_COLUMNS)
    .single();

  if (createError || !created) {
    throw new ProfileHttpError(
      "Não foi possível criar o cartão.",
      500,
      "PROFILE_CARD_CREATE_FAILED"
    );
  }

  if (replaceCardId) {
    const { error: retireError } = await db
      .from("professional_profile_cards")
      .update({
        status: "replaced",
        retired_at: now,
      })
      .eq("id", replaceCardId)
      .eq("profile_id", profileId);
    if (retireError) {
      throw new ProfileHttpError(
        "O cartão foi criado, mas não foi possível aposentar o anterior.",
        500,
        "PROFILE_CARD_REPLACE_FAILED"
      );
    }
  }

  return mapCard(created as Row);
}

export async function setProfileCardStatus(
  cardId: string,
  status: ProfileCardStatus,
  actorId: string
): Promise<void> {
  if (status === "replaced" || status === "pending") {
    throw new ProfileHttpError(
      "Status inválido para alteração direta.",
      400,
      "PROFILE_CARD_STATUS_INVALID"
    );
  }

  const db = createProfileAdminClient();
  const { data: card, error } = await db
    .from("professional_profile_cards")
    .select(CARD_COLUMNS)
    .eq("id", cardId)
    .maybeSingle();

  if (error || !card) {
    throw new ProfileHttpError("Cartão não encontrado.", 404, "PROFILE_CARD_NOT_FOUND");
  }

  const current = card.status as ProfileCardStatus;
  if (current === "replaced") {
    throw new ProfileHttpError(
      "Cartões substituídos não podem mudar de status.",
      400,
      "PROFILE_CARD_REPLACED"
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };

  if (status === "active") {
    const profile = await loadProfileStatus(db, card.profile_id as string);
    assertCanActivateProfileCard(profile.status);
    patch.activated_at = now;
    patch.retired_at = null;

    // Apenas um cartão ativo por perfil.
    await db
      .from("professional_profile_cards")
      .update({ status: "inactive", retired_at: now })
      .eq("profile_id", card.profile_id as string)
      .eq("status", "active")
      .neq("id", cardId);
  }

  if (status === "inactive") {
    patch.retired_at = now;
  }

  const { error: updateError } = await db
    .from("professional_profile_cards")
    .update(patch)
    .eq("id", cardId);

  if (updateError) {
    throw new ProfileHttpError(
      "Não foi possível atualizar o status do cartão.",
      500,
      "PROFILE_CARD_STATUS_FAILED"
    );
  }
}

/**
 * Marca (ou desmarca) que a etiqueta física foi gravada. Não mexe no status
 * digital do cartão nem exige perfil publicado — é só o checklist manual de
 * produção, separado da lógica que controla o redirecionamento do toque.
 */
export async function setProfileCardPhysicalStatus(
  cardId: string,
  done: boolean
): Promise<ProfessionalProfileCard> {
  const db = createProfileAdminClient();
  const { data: updated, error } = await db
    .from("professional_profile_cards")
    .update({ physically_activated_at: done ? new Date().toISOString() : null })
    .eq("id", cardId)
    .select(CARD_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new ProfileHttpError(
      "Não foi possível atualizar a confirmação física do cartão.",
      500,
      "PROFILE_CARD_PHYSICAL_FAILED"
    );
  }
  if (!updated) {
    throw new ProfileHttpError("Cartão não encontrado.", 404, "PROFILE_CARD_NOT_FOUND");
  }

  return mapCard(updated as Row);
}

export async function getProfileCardQrPayload(
  cardId: string
): Promise<{ url: string; png: Buffer }> {
  const db = createProfileAdminClient();
  const { data: card, error } = await db
    .from("professional_profile_cards")
    .select("id, nfc_tag_id, status")
    .eq("id", cardId)
    .maybeSingle();

  if (error || !card) {
    throw new ProfileHttpError("Cartão não encontrado.", 404, "PROFILE_CARD_NOT_FOUND");
  }
  if (!card.nfc_tag_id) {
    throw new ProfileHttpError(
      "Este cartão ainda não possui etiqueta NFC.",
      400,
      "PROFILE_CARD_NO_TAG"
    );
  }

  const { data: tag, error: tagError } = await db
    .from("nfc_tags")
    .select("public_token")
    .eq("id", card.nfc_tag_id as string)
    .is("deleted_at", null)
    .maybeSingle();

  if (tagError || !tag?.public_token) {
    throw new ProfileHttpError(
      "Etiqueta NFC do cartão não encontrada.",
      404,
      "PROFILE_CARD_TAG_NOT_FOUND"
    );
  }

  const url = getNfcPublicUrl(String(tag.public_token), process.env, { source: "qr" });
  const png = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
    color: { dark: "#04202f", light: "#ffffff" },
  });

  return { url, png: Buffer.from(png) };
}

/**
 * Carrega a dica pública do perfil para resolução NFC (sem campos privados).
 */
export async function loadProfessionalProfilePublicHint(
  db: SupabaseClient,
  profileId: string
): Promise<ProfessionalProfilePublicHint | null> {
  const { data: profile } = await db
    .from("professional_profiles")
    .select("id, slug, status")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return null;

  const { data: localization } = await db
    .from("professional_profile_localizations")
    .select("display_name, locale")
    .eq("profile_id", profileId)
    .eq("locale", "pt-BR")
    .maybeSingle();

  const displayName =
    (localization?.display_name as string | null | undefined)?.trim() ||
    String(profile.slug);

  return {
    id: String(profile.id),
    slug: String(profile.slug),
    status: profile.status as ProfessionalProfileStatus,
    displayName,
    locale: "pt-BR",
  };
}

export async function findProfileCardByTagId(
  db: SupabaseClient,
  tagId: string
): Promise<ProfessionalProfileCard | null> {
  const { data } = await db
    .from("professional_profile_cards")
    .select(CARD_COLUMNS)
    .eq("nfc_tag_id", tagId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapCard(data as Row) : null;
}
