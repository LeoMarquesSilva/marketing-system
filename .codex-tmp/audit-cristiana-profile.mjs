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

const email = "cristiana.costa@bismarchipires.com.br";
const { data: user, error: userError } = await db
  .from("users")
  .select("id, name, email, department, is_active, avatar_url, photo_collected, photo_collected_at")
  .eq("email", email)
  .single();
if (userError) throw userError;

const { data: profile, error: profileError } = await db
  .from("professional_profiles")
  .select("id, slug, status, photo_url, joined_on, professional_email, show_email, show_linkedin")
  .eq("user_id", user.id)
  .single();
if (profileError) throw profileError;

const { data: localization, error: localizationError } = await db
  .from("professional_profile_localizations")
  .select("locale, is_approved, display_name, role, practice_area, tagline, bio")
  .eq("profile_id", profile.id)
  .eq("locale", "pt-BR")
  .single();
if (localizationError) throw localizationError;

const { data: cards, error: cardsError } = await db
  .from("professional_profile_cards")
  .select("id, code, label, status, nfc_tag_id, physically_activated_at")
  .eq("profile_id", profile.id);
if (cardsError) throw cardsError;

const tagIds = (cards ?? []).map((card) => card.nfc_tag_id).filter(Boolean);
const tagsResult = tagIds.length
  ? await db
      .from("nfc_tags")
      .select("id, code, status, action_type, action_config, deleted_at")
      .in("id", tagIds)
  : { data: [], error: null };
if (tagsResult.error) throw tagsResult.error;

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

console.log(
  JSON.stringify(
    {
      user,
      profile,
      localization,
      cards: cards ?? [],
      nfcTags: tagsResult.data ?? [],
      verification: {
        appearsInCollaboratorPhotos: user.is_active === true,
        photoIsPending: user.photo_collected === false && !user.avatar_url,
        emailContactEnabled: profile.show_email === true,
        missingPublishRequirements: missing,
        profilePublished: profile.status === "published",
        namedCardCreated: (cards ?? []).some((card) => card.label === user.name),
        nfcTagLinked: (tagsResult.data ?? []).some(
          (tag) =>
            tag.status === "active" &&
            tag.action_type === "professional_profile" &&
            tag.action_config?.profileId === profile.id &&
            !tag.deleted_at,
        ),
        expectedPublicUrl: `https://marketing-system-xi.vercel.app/perfil/${profile.slug}`,
      },
    },
    null,
    2,
  ),
);
