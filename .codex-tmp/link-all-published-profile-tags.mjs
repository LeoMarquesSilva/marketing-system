import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase configuration is missing.");
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";

const [profilesResult, usersResult, localizationsResult, cardsResult, tagsResult] =
  await Promise.all([
    db.from("professional_profiles").select("id, user_id, slug, status"),
    db.from("users").select("id, name, is_active"),
    db
      .from("professional_profile_localizations")
      .select("profile_id, locale, display_name")
      .eq("locale", "pt-BR"),
    db
      .from("professional_profile_cards")
      .select("id, profile_id, nfc_tag_id, code, label, status, physically_activated_at"),
    db.from("nfc_tags").select("id, code, deleted_at"),
  ]);

for (const result of [
  profilesResult,
  usersResult,
  localizationsResult,
  cardsResult,
  tagsResult,
]) {
  if (result.error) throw result.error;
}

const usersById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));
const localizationByProfileId = new Map(
  (localizationsResult.data ?? []).map((item) => [item.profile_id, item]),
);
const liveTagIds = new Set(
  (tagsResult.data ?? []).filter((tag) => !tag.deleted_at).map((tag) => tag.id),
);
const cardsByProfileId = new Map();
for (const card of cardsResult.data ?? []) {
  cardsByProfileId.set(card.profile_id, [
    ...(cardsByProfileId.get(card.profile_id) ?? []),
    card,
  ]);
}

const activePublishedProfiles = (profilesResult.data ?? [])
  .filter(
    (profile) =>
      profile.status === "published" && usersById.get(profile.user_id)?.is_active === true,
  )
  .map((profile) => ({
    ...profile,
    displayName:
      localizationByProfileId.get(profile.id)?.display_name ||
      usersById.get(profile.user_id)?.name ||
      profile.slug,
  }));

const missing = activePublishedProfiles.filter((profile) =>
  !(cardsByProfileId.get(profile.id) ?? []).some(
    (card) => card.nfc_tag_id && liveTagIds.has(card.nfc_tag_id),
  ),
);

if (activePublishedProfiles.length !== 56 || missing.length !== 23) {
  throw new Error(
    `Preflight mismatch: expected 56 published/23 missing, found ${activePublishedProfiles.length}/${missing.length}.`,
  );
}

const forbiddenNames = activePublishedProfiles.filter((profile) =>
  /camila|carlos.*zamboni/i.test(profile.displayName),
);
if (forbiddenNames.length > 0) {
  throw new Error("Camila or Carlos Zamboni unexpectedly matched the update scope.");
}

function largestCode(rows, prefix) {
  return rows.reduce((max, row) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(String(row.code));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

let nextNfcNumber = largestCode(tagsResult.data ?? [], "NFC");
let nextCardNumber = largestCode(cardsResult.data ?? [], "PPC");
const created = [];

for (const profile of missing.sort((a, b) =>
  a.displayName.localeCompare(b.displayName, "pt-BR"),
)) {
  nextNfcNumber += 1;
  nextCardNumber += 1;
  const nfcCode = `NFC-${String(nextNfcNumber).padStart(4, "0")}`;
  const cardCode = `PPC-${String(nextCardNumber).padStart(4, "0")}`;

  const { data: tag, error: tagError } = await db
    .from("nfc_tags")
    .insert({
      code: nfcCode,
      public_token: `nfc_${randomBytes(18).toString("base64url")}`,
      name: profile.displayName,
      description: `Cartão NFC do perfil ${profile.displayName}`,
      environment: "Material comercial",
      category: "Perfil profissional",
      status: "active",
      access_mode: "public",
      action_type: "professional_profile",
      action_config: { profileId: profile.id },
      cooldown_seconds: 0,
      created_by: actorId,
    })
    .select("id, code")
    .single();
  if (tagError) throw tagError;

  const now = new Date().toISOString();
  const { data: card, error: cardError } = await db
    .from("professional_profile_cards")
    .insert({
      profile_id: profile.id,
      nfc_tag_id: tag.id,
      code: cardCode,
      label: profile.displayName,
      status: "pending",
      issued_at: now,
      physically_activated_at: now,
    })
    .select("id, code")
    .single();

  if (cardError) {
    await db.from("nfc_tags").delete().eq("id", tag.id);
    throw cardError;
  }

  created.push({
    name: profile.displayName,
    slug: profile.slug,
    nfcCode: tag.code,
    cardCode: card.code,
  });
}

const [refreshedCardsResult, refreshedTagsResult] = await Promise.all([
  db
    .from("professional_profile_cards")
    .select("id, profile_id, nfc_tag_id, physically_activated_at"),
  db.from("nfc_tags").select("id, deleted_at"),
]);
if (refreshedCardsResult.error) throw refreshedCardsResult.error;
if (refreshedTagsResult.error) throw refreshedTagsResult.error;

const refreshedLiveTagIds = new Set(
  (refreshedTagsResult.data ?? []).filter((tag) => !tag.deleted_at).map((tag) => tag.id),
);
const activeProfileIds = new Set(activePublishedProfiles.map((profile) => profile.id));
const cardsToMark = (refreshedCardsResult.data ?? []).filter(
  (card) =>
    activeProfileIds.has(card.profile_id) &&
    card.nfc_tag_id &&
    refreshedLiveTagIds.has(card.nfc_tag_id) &&
    !card.physically_activated_at,
);

if (cardsToMark.length > 0) {
  const { error: markError } = await db
    .from("professional_profile_cards")
    .update({ physically_activated_at: new Date().toISOString() })
    .in(
      "id",
      cardsToMark.map((card) => card.id),
    );
  if (markError) throw markError;
}

console.log(
  JSON.stringify(
    {
      createdDigitalLinks: created.length,
      existingPhysicalCardsMarked: cardsToMark.length,
      excludedCamilaAndCarlosZamboni: true,
      created,
    },
    null,
    2,
  ),
);
