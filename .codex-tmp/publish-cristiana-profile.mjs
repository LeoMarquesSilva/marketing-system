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
const profileId = "54dcbf9b-3147-487b-b8e0-088cdb6ddb8f";
const displayName = "Cristiana Pereira da Costa";

const [profileResult, localizationResult] = await Promise.all([
  db
    .from("professional_profiles")
    .select("id, user_id, slug, status, photo_url, professional_email, show_email")
    .eq("id", profileId)
    .single(),
  db
    .from("professional_profile_localizations")
    .select("display_name, role, practice_area, tagline, bio")
    .eq("profile_id", profileId)
    .eq("locale", "pt-BR")
    .single(),
]);
if (profileResult.error) throw profileResult.error;
if (localizationResult.error) throw localizationResult.error;

const { data: user, error: userError } = await db
  .from("users")
  .select("avatar_url")
  .eq("id", profileResult.data.user_id)
  .single();
if (userError) throw userError;

const profile = profileResult.data;
const localization = localizationResult.data;
const missing = [];
if (!profile.slug?.trim()) missing.push("slug");
if (!(profile.photo_url?.trim() || user.avatar_url?.trim())) missing.push("photo");
if (!localization.display_name?.trim()) missing.push("displayName");
if (!localization.role?.trim()) missing.push("role");
if (!localization.practice_area?.trim()) missing.push("practiceArea");
if (!localization.tagline?.trim()) missing.push("tagline");
if (!localization.bio?.trim()) missing.push("bio");
if (!profile.professional_email?.trim()) missing.push("professionalEmail");
if (!(profile.show_email && profile.professional_email?.trim())) missing.push("contactAction");
if (missing.length > 0) {
  throw new Error(`Perfil ainda incompleto: ${missing.join(", ")}`);
}

let publishedNow = false;
if (profile.status !== "published") {
  const now = new Date().toISOString();
  const { error: publishError } = await db
    .from("professional_profiles")
    .update({
      status: "published",
      published_at: now,
      updated_by: actorId,
    })
    .eq("id", profileId);
  if (publishError) throw publishError;
  publishedNow = true;
}

const { data: existingCard, error: existingCardError } = await db
  .from("professional_profile_cards")
  .select("id, code, nfc_tag_id")
  .eq("profile_id", profileId)
  .eq("label", displayName)
  .maybeSingle();
if (existingCardError) throw existingCardError;

let cardCreated = false;
let cardId = existingCard?.id ?? null;
let nfcTagId = existingCard?.nfc_tag_id ?? null;

if (!existingCard) {
  const [cardCodesResult, nfcCodesResult] = await Promise.all([
    db.from("professional_profile_cards").select("code").like("code", "PPC-%"),
    db.from("nfc_tags").select("code").like("code", "NFC-%"),
  ]);
  if (cardCodesResult.error) throw cardCodesResult.error;
  if (nfcCodesResult.error) throw nfcCodesResult.error;

  const nextCode = (prefix, rows) => {
    const largest = (rows ?? []).reduce((max, row) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(String(row.code));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(largest + 1).padStart(4, "0")}`;
  };

  const nfcCode = nextCode("NFC", nfcCodesResult.data);
  const cardCode = nextCode("PPC", cardCodesResult.data);
  const { data: tag, error: tagError } = await db
    .from("nfc_tags")
    .insert({
      code: nfcCode,
      public_token: `nfc_${randomBytes(18).toString("base64url")}`,
      name: displayName,
      description: `Cartão NFC do perfil ${displayName}`,
      environment: "Material comercial",
      category: "Perfil profissional",
      status: "active",
      access_mode: "public",
      action_type: "professional_profile",
      action_config: { profileId },
      cooldown_seconds: 0,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (tagError) throw tagError;
  nfcTagId = tag.id;

  const now = new Date().toISOString();
  const { data: card, error: cardError } = await db
    .from("professional_profile_cards")
    .insert({
      profile_id: profileId,
      nfc_tag_id: nfcTagId,
      code: cardCode,
      label: displayName,
      status: "pending",
      issued_at: now,
    })
    .select("id")
    .single();
  if (cardError) {
    await db.from("nfc_tags").delete().eq("id", nfcTagId);
    throw cardError;
  }
  cardId = card.id;
  cardCreated = true;
}

console.log(
  JSON.stringify(
    {
      profileId,
      publishedNow,
      cardCreated,
      cardId,
      nfcTagId,
      missingRequirements: missing,
    },
    null,
    2,
  ),
);
