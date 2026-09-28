import "dotenv/config";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase configuration is missing.");
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [profilesResult, usersResult, localizationsResult, cardsResult, tagsResult] =
  await Promise.all([
    db.from("professional_profiles").select("id, user_id, slug, status").eq("status", "published"),
    db.from("users").select("id, name, is_active"),
    db
      .from("professional_profile_localizations")
      .select("profile_id, locale, display_name")
      .eq("locale", "pt-BR"),
    db
      .from("professional_profile_cards")
      .select("id, profile_id, nfc_tag_id, status, physically_activated_at"),
    db.from("nfc_tags").select("id, deleted_at"),
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
const tagsById = new Map((tagsResult.data ?? []).map((tag) => [tag.id, tag]));
const cardsByProfileId = new Map();
for (const card of cardsResult.data ?? []) {
  cardsByProfileId.set(card.profile_id, [
    ...(cardsByProfileId.get(card.profile_id) ?? []),
    card,
  ]);
}

const baseUrl = "https://marketing-system-xi.vercel.app";
const manuallyConfirmedPhysicalSlugs = new Set([
  "giovanna-pereira-de-souza",
  "julia-antonini-morel",
  "maria-heloiza-gois-ponce",
  "samuel-willian-silva",
  "vinicius-canto-hecksher",
]);
const rows = (profilesResult.data ?? [])
  .filter((profile) => usersById.get(profile.user_id)?.is_active === true)
  .map((profile) => {
    const user = usersById.get(profile.user_id) ?? null;
    const localization = localizationByProfileId.get(profile.id) ?? null;
    const cards = cardsByProfileId.get(profile.id) ?? [];
    const physicalDone = manuallyConfirmedPhysicalSlugs.has(profile.slug) || cards.some((card) => {
      const tag = tagsById.get(card.nfc_tag_id) ?? null;
      return (
        Boolean(card.physically_activated_at) &&
        card.status !== "retired" &&
        card.status !== "replaced" &&
        tag &&
        !tag.deleted_at
      );
    });
    return {
      name: localization?.display_name || user?.name || profile.slug,
      profileUrl: `${baseUrl}/perfil/${encodeURIComponent(profile.slug)}`,
      physicalDone,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

const wagner = rows.find((row) => row.name === "Wagner José Penereiro Armani");
const expectedWagnerUrl =
  "https://marketing-system-xi.vercel.app/perfil/wagner-jose-penereiro-armani";
if (wagner?.profileUrl !== expectedWagnerUrl) {
  throw new Error("Profile-link pattern verification failed for Wagner.");
}

const payload = {
  rows,
  summary: {
    publishedProfiles: rows.length,
    physicalDone: rows.filter((row) => row.physicalDone).length,
    physicalPending: rows.filter((row) => !row.physicalDone).length,
  },
};

await fs.writeFile(
  ".codex-tmp/nfc-report/direct-profile-links.json",
  JSON.stringify(payload, null, 2),
  "utf8",
);
console.log(JSON.stringify(payload.summary));
