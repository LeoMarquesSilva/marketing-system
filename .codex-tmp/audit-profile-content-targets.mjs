import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase configuration is missing.");

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: users, error: usersError } = await db
  .from("users")
  .select("id, name, email, department, is_active")
  .or("name.ilike.%Gustavo%,name.ilike.%Ricardo%,name.ilike.%Leonardo%Marques%")
  .order("name");
if (usersError) throw usersError;

const userIds = (users ?? []).map((user) => user.id);
const { data: profiles, error: profilesError } = await db
  .from("professional_profiles")
  .select("id, user_id, slug, status, updated_at")
  .in("user_id", userIds);
if (profilesError) throw profilesError;

const profileIds = (profiles ?? []).map((profile) => profile.id);
const [localizationsResult, sectionsResult] = await Promise.all([
  db
    .from("professional_profile_localizations")
    .select("profile_id, locale, is_approved, display_name, role, practice_area, tagline, bio")
    .in("profile_id", profileIds)
    .eq("locale", "pt-BR"),
  db
    .from("professional_profile_sections")
    .select("id, profile_id, section_key, enabled, sort_order")
    .in("profile_id", profileIds)
    .order("sort_order"),
]);
if (localizationsResult.error) throw localizationsResult.error;
if (sectionsResult.error) throw sectionsResult.error;

const sectionIds = (sectionsResult.data ?? []).map((section) => section.id);
const entriesResult = sectionIds.length
  ? await db
      .from("professional_profile_entries")
      .select("id, section_id, entry_type, sort_order, is_visible")
      .in("section_id", sectionIds)
      .order("sort_order")
  : { data: [], error: null };
if (entriesResult.error) throw entriesResult.error;

const entryIds = (entriesResult.data ?? []).map((entry) => entry.id);
const entryLocalizationsResult = entryIds.length
  ? await db
      .from("professional_profile_entry_localizations")
      .select("entry_id, locale, title, subtitle, description")
      .in("entry_id", entryIds)
      .eq("locale", "pt-BR")
  : { data: [], error: null };
if (entryLocalizationsResult.error) throw entryLocalizationsResult.error;

console.log(
  JSON.stringify(
    {
      users,
      profiles,
      localizations: localizationsResult.data ?? [],
      sections: sectionsResult.data ?? [],
      entries: entriesResult.data ?? [],
      entryLocalizations: entryLocalizationsResult.data ?? [],
    },
    null,
    2,
  ),
);
