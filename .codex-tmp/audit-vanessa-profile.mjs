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

const email = "vanessa.sellani@bismarchipires.com.br";
const [usersResult, hrResult] = await Promise.all([
  db
    .from("users")
    .select("id, name, email, department, is_active, avatar_url, photo_onedrive_url, photo_collected, photo_collected_at")
    .or(`email.ilike.${email},name.ilike.%Vanessa%Sellani%`),
  db
    .from("hr_employees")
    .select("id, user_id, full_name, email, department, position, admission_date, is_active")
    .or(`email.ilike.${email},full_name.ilike.%Vanessa%Sellani%`),
]);

if (usersResult.error) throw usersResult.error;
if (hrResult.error) throw hrResult.error;

const userIds = (usersResult.data ?? []).map((user) => user.id);
const profilesResult = userIds.length
  ? await db
      .from("professional_profiles")
      .select("id, user_id, slug, status, photo_url, professional_email, linkedin_url, show_email, show_linkedin")
      .in("user_id", userIds)
  : { data: [], error: null };

if (profilesResult.error) throw profilesResult.error;

const profileIds = (profilesResult.data ?? []).map((profile) => profile.id);
const localizationsResult = profileIds.length
  ? await db
      .from("professional_profile_localizations")
      .select("profile_id, locale, is_approved, display_name, role, practice_area, tagline, bio")
      .in("profile_id", profileIds)
  : { data: [], error: null };

if (localizationsResult.error) throw localizationsResult.error;

const profile = profilesResult.data?.[0] ?? null;
const user = usersResult.data?.[0] ?? null;
const pt = localizationsResult.data?.find((item) => item.locale === "pt-BR") ?? null;
const missing = [];
if (!profile?.slug?.trim()) missing.push("slug");
if (!(profile?.photo_url?.trim() || user?.avatar_url?.trim())) missing.push("photo");
if (!pt?.display_name?.trim()) missing.push("displayName");
if (!pt?.role?.trim()) missing.push("role");
if (!pt?.practice_area?.trim()) missing.push("practiceArea");
if (!pt?.tagline?.trim()) missing.push("tagline");
if (!pt?.bio?.trim()) missing.push("bio");
if (!profile?.professional_email?.trim()) missing.push("professionalEmail");
const hasContactAction =
  (profile?.show_email && profile.professional_email?.trim()) ||
  (profile?.show_linkedin && profile.linkedin_url?.trim());
if (!hasContactAction) missing.push("contactAction");

console.log(
  JSON.stringify(
    {
      users: usersResult.data ?? [],
      hrEmployees: hrResult.data ?? [],
      profiles: profilesResult.data ?? [],
      localizations: localizationsResult.data ?? [],
      verification: {
        appearsInCollaboratorPhotos: user?.is_active === true,
        photoIsPending: user?.photo_collected === false && !user?.avatar_url,
        missingPublishRequirements: missing,
        expectedPublicUrl: `https://marketing-system-xi.vercel.app/perfil/${profile?.slug ?? ""}`,
      },
    },
    null,
    2,
  ),
);
