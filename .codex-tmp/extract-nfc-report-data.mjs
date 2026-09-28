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

const baseUrl = (
  process.env.NFC_PUBLIC_BASE_URL ||
  process.env.MARKETING_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://marketing-system-xi.vercel.app"
).replace(/\/+$/, "");

const [cardsResult, tagsResult, profilesResult, usersResult, localizationsResult] =
  await Promise.all([
    db
      .from("professional_profile_cards")
      .select(
        "id, profile_id, nfc_tag_id, code, label, status, created_at, issued_at, activated_at, physically_activated_at",
      ),
    db
      .from("nfc_tags")
      .select(
        "id, code, public_token, status, deleted_at, total_scans, last_scanned_at",
      ),
    db.from("professional_profiles").select("id, user_id, slug, status"),
    db.from("users").select("id, name"),
    db
      .from("professional_profile_localizations")
      .select("profile_id, locale, display_name, role, practice_area")
      .eq("locale", "pt-BR"),
  ]);

for (const result of [
  cardsResult,
  tagsResult,
  profilesResult,
  usersResult,
  localizationsResult,
]) {
  if (result.error) throw result.error;
}

const cards = cardsResult.data ?? [];
const tags = tagsResult.data ?? [];
const profiles = profilesResult.data ?? [];
const users = usersResult.data ?? [];
const localizations = localizationsResult.data ?? [];

const tagById = new Map(tags.map((tag) => [tag.id, tag]));
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
const userById = new Map(users.map((user) => [user.id, user]));
const localizationByProfileId = new Map(
  localizations.map((localization) => [localization.profile_id, localization]),
);

const localDate = (value) => {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
};

const reportDate = "2026-08-10";
const yesterday = "2026-08-09";

const reportCards = cards
  .map((card) => {
    const tag = tagById.get(card.nfc_tag_id) ?? null;
    const profile = profileById.get(card.profile_id) ?? null;
    const user = profile ? userById.get(profile.user_id) ?? null : null;
    const localization = profile
      ? localizationByProfileId.get(profile.id) ?? null
      : null;
    return { card, tag, profile, user, localization };
  })
  .filter(
    ({ card, tag }) =>
      tag &&
      tag.public_token &&
      !tag.deleted_at &&
      card.status !== "retired" &&
      card.status !== "replaced",
  )
  .map(({ card, tag, profile, user, localization }) => {
    const physicalDate = localDate(card.physically_activated_at);
    return {
      collaborator:
        localization?.display_name || user?.name || card.label || card.code,
      role: localization?.role ?? "",
      practiceArea: localization?.practice_area ?? "",
      profileSlug: profile?.slug ?? "",
      profileStatus: profile?.status ?? "",
      cardCode: card.code,
      cardStatus: card.status,
      tagCode: tag.code,
      tagStatus: tag.status,
      nfcUrl: `${baseUrl}/t/${encodeURIComponent(tag.public_token)}?source=nfc`,
      physicallyRecorded: Boolean(card.physically_activated_at),
      physicallyRecordedAt: card.physically_activated_at,
      physicallyRecordedDate: physicalDate,
      doneYesterday: physicalDate === yesterday,
      totalScans: tag.total_scans ?? 0,
      lastScannedAt: tag.last_scanned_at,
    };
  })
  .sort((a, b) => {
    if (a.physicallyRecorded !== b.physicallyRecorded) {
      return Number(a.physicallyRecorded) - Number(b.physicallyRecorded);
    }
    return a.collaborator.localeCompare(b.collaborator, "pt-BR");
  });

const profilesWithValidCard = new Set(reportCards.map((row) => row.profileSlug));
const missingCards = profiles
  .filter(
    (profile) =>
      profile.status === "published" && !profilesWithValidCard.has(profile.slug),
  )
  .map((profile) => {
    const user = userById.get(profile.user_id) ?? null;
    const localization = localizationByProfileId.get(profile.id) ?? null;
    return {
      collaborator: localization?.display_name || user?.name || profile.slug,
      role: localization?.role ?? "",
      practiceArea: localization?.practice_area ?? "",
      profileSlug: profile.slug,
      profileUrl: `${baseUrl}/perfil/${encodeURIComponent(profile.slug)}`,
      situation: "Perfil publicado sem cartão/tag NFC válido",
      nextStep: "Criar e vincular cartão NFC antes da gravação",
    };
  })
  .sort((a, b) => a.collaborator.localeCompare(b.collaborator, "pt-BR"));

const invalidHistoricalCards = cards.filter((card) => {
  const tag = tagById.get(card.nfc_tag_id) ?? null;
  return !tag || Boolean(tag.deleted_at) || ["retired", "replaced"].includes(card.status);
});

const payload = {
  generatedAt: new Date().toISOString(),
  reportDate,
  yesterday,
  baseUrl,
  cards: reportCards,
  missingCards,
  invalidHistoricalCardsCount: invalidHistoricalCards.length,
  summary: {
    validTags: reportCards.length,
    physicallyRecorded: reportCards.filter((row) => row.physicallyRecorded).length,
    doneYesterday: reportCards.filter((row) => row.doneYesterday).length,
    pendingPhysical: reportCards.filter((row) => !row.physicallyRecorded).length,
    publishedWithoutCard: missingCards.length,
  },
};

await fs.mkdir(".codex-tmp/nfc-report", { recursive: true });
await fs.writeFile(
  ".codex-tmp/nfc-report/data.json",
  JSON.stringify(payload, null, 2),
  "utf8",
);

console.log(JSON.stringify(payload.summary));
