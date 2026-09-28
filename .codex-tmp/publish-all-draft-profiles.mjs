import "dotenv/config";
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

const [profilesResult, usersResult, localizationsResult] = await Promise.all([
  db
    .from("professional_profiles")
    .select(
      "id, user_id, slug, status, photo_url, professional_email, professional_phone, linkedin_url, website_url, show_whatsapp, show_linkedin, show_website",
    )
    .eq("status", "draft"),
  db.from("users").select("id, is_active, avatar_url, photo_onedrive_url"),
  db
    .from("professional_profile_localizations")
    .select("profile_id, locale, display_name, role, practice_area, tagline, bio")
    .eq("locale", "pt-BR"),
]);
for (const result of [profilesResult, usersResult, localizationsResult]) {
  if (result.error) throw result.error;
}

const usersById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));
const localizationByProfileId = new Map(
  (localizationsResult.data ?? []).map((item) => [item.profile_id, item]),
);
const hasText = (value) => Boolean(String(value ?? "").trim());
const drafts = (profilesResult.data ?? []).filter(
  (profile) => usersById.get(profile.user_id)?.is_active === true,
);

if (drafts.length !== 17) {
  throw new Error(`Preflight expected 17 active draft profiles, found ${drafts.length}.`);
}

const incomplete = drafts
  .map((profile) => {
    const user = usersById.get(profile.user_id);
    const localization = localizationByProfileId.get(profile.id);
    const missing = [];
    if (!hasText(profile.slug)) missing.push("slug");
    if (
      !hasText(profile.photo_url) &&
      !hasText(user?.avatar_url) &&
      !hasText(user?.photo_onedrive_url)
    ) {
      missing.push("photo");
    }
    if (!hasText(localization?.display_name)) missing.push("displayName");
    if (!hasText(localization?.role)) missing.push("role");
    if (!hasText(localization?.practice_area)) missing.push("practiceArea");
    if (!hasText(localization?.tagline)) missing.push("tagline");
    if (!hasText(localization?.bio)) missing.push("bio");
    if (!hasText(profile.professional_email)) missing.push("professionalEmail");
    return { slug: profile.slug, missing };
  })
  .filter((profile) => profile.missing.length > 0);

if (incomplete.length > 0) {
  throw new Error(`Draft profiles remain incomplete: ${JSON.stringify(incomplete)}`);
}

const publishedAt = new Date().toISOString();
const draftIds = drafts.map((profile) => profile.id);
const { data: published, error: publishError } = await db
  .from("professional_profiles")
  .update({
    show_email: true,
    status: "published",
    published_at: publishedAt,
    updated_by: actorId,
  })
  .in("id", draftIds)
  .select("id, slug, status, show_email, published_at");
if (publishError) throw publishError;
if (published.length !== draftIds.length) {
  throw new Error(`Expected ${draftIds.length} published profiles, updated ${published.length}.`);
}

const physicalSlugs = ["ana-nunes-galvao", "daniela-lagoeiro-dos-santos"];
const { data: physicalProfiles, error: physicalProfilesError } = await db
  .from("professional_profiles")
  .select("id, slug")
  .in("slug", physicalSlugs);
if (physicalProfilesError) throw physicalProfilesError;

const { data: candidateCards, error: cardsError } = await db
  .from("professional_profile_cards")
  .select("id, profile_id, nfc_tag_id, status")
  .in(
    "profile_id",
    physicalProfiles.map((profile) => profile.id),
  );
if (cardsError) throw cardsError;

const { data: validTags, error: tagsError } = await db
  .from("nfc_tags")
  .select("id")
  .in(
    "id",
    candidateCards.map((card) => card.nfc_tag_id).filter(Boolean),
  )
  .is("deleted_at", null);
if (tagsError) throw tagsError;
const validTagIds = new Set(validTags.map((tag) => tag.id));
const physicalCardIds = candidateCards
  .filter(
    (card) =>
      !["retired", "replaced"].includes(card.status) &&
      validTagIds.has(card.nfc_tag_id),
  )
  .map((card) => card.id);
if (physicalCardIds.length !== 2) {
  throw new Error(`Expected 2 valid cards for physical update, found ${physicalCardIds.length}.`);
}

const { data: physicalCards, error: physicalUpdateError } = await db
  .from("professional_profile_cards")
  .update({ physically_activated_at: publishedAt })
  .in("id", physicalCardIds)
  .select("id, physically_activated_at");
if (physicalUpdateError) throw physicalUpdateError;

console.log(
  JSON.stringify(
    {
      publishedProfiles: published.length,
      emailEnabled: published.filter((profile) => profile.show_email).length,
      physicalCardsUpdated: physicalCards.length,
    },
    null,
    2,
  ),
);
