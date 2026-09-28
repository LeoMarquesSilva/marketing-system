import "dotenv/config";
import { randomUUID } from "node:crypto";
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
const person = {
  name: "Cristiana Pereira da Costa",
  email: "cristiana.costa@bismarchipires.com.br",
  department: "Operações Legais",
  role: "Auxiliar de Limpeza",
  joinedOn: "2025-06-02",
  slug: "cristiana-pereira-da-costa",
  tagline: "Profissional de apoio operacional, atua como Auxiliar de Limpeza na equipe de Operações Legais.",
  bio: "Integra a equipe Bismarchi | Pires desde junho de 2025. Atua na organização, conservação e cuidado dos ambientes do escritório, contribuindo diariamente para um espaço acolhedor, funcional e adequado ao trabalho das equipes.",
};

const { data: matchingUsers, error: matchingUsersError } = await db
  .from("users")
  .select("id, name, email")
  .or(`email.ilike.${person.email},name.ilike.${person.name}`);

if (matchingUsersError) throw matchingUsersError;
if ((matchingUsers ?? []).length > 1) {
  throw new Error("More than one matching Cristiana user was found; refusing to guess.");
}

let userId = matchingUsers?.[0]?.id ?? null;
let userCreated = false;

if (!userId) {
  userId = randomUUID();
  const { error: insertUserError } = await db.from("users").insert({
    id: userId,
    name: person.name,
    email: person.email,
    department: person.department,
    avatar_url: null,
    photo_onedrive_url: null,
    photo_collected: false,
    photo_collected_at: null,
    is_active: true,
  });
  if (insertUserError) throw insertUserError;
  userCreated = true;
} else {
  const { error: updateUserError } = await db
    .from("users")
    .update({
      name: person.name,
      email: person.email,
      department: person.department,
      is_active: true,
    })
    .eq("id", userId);
  if (updateUserError) throw updateUserError;
}

const { data: existingProfile, error: existingProfileError } = await db
  .from("professional_profiles")
  .select("id, status")
  .eq("user_id", userId)
  .maybeSingle();

if (existingProfileError) throw existingProfileError;

let profileId = existingProfile?.id ?? null;
let profileCreated = false;
const profileValues = {
  user_id: userId,
  slug: person.slug,
  status: existingProfile?.status ?? "draft",
  joined_on: person.joinedOn,
  professional_email: person.email,
  linkedin_url: null,
  show_tenure: true,
  show_email: true,
  show_whatsapp: false,
  show_linkedin: false,
  show_website: false,
  updated_by: actorId,
};

if (!profileId) {
  const { data: insertedProfile, error: insertProfileError } = await db
    .from("professional_profiles")
    .insert({ ...profileValues, created_by: actorId })
    .select("id")
    .single();
  if (insertProfileError) throw insertProfileError;
  profileId = insertedProfile.id;
  profileCreated = true;
} else {
  const { error: updateProfileError } = await db
    .from("professional_profiles")
    .update(profileValues)
    .eq("id", profileId);
  if (updateProfileError) throw updateProfileError;
}

const { error: localizationError } = await db
  .from("professional_profile_localizations")
  .upsert(
    {
      profile_id: profileId,
      locale: "pt-BR",
      is_approved: true,
      display_name: person.name,
      role: person.role,
      practice_area: person.department,
      tagline: person.tagline,
      bio: person.bio,
    },
    { onConflict: "profile_id,locale" },
  );
if (localizationError) throw localizationError;

const { error: sectionsError } = await db
  .from("professional_profile_sections")
  .upsert(
    [
      { profile_id: profileId, section_key: "practice", enabled: true, sort_order: 0 },
      { profile_id: profileId, section_key: "education", enabled: true, sort_order: 1 },
      { profile_id: profileId, section_key: "knowledge", enabled: true, sort_order: 2 },
      { profile_id: profileId, section_key: "highlights", enabled: true, sort_order: 3 },
      { profile_id: profileId, section_key: "timeline", enabled: true, sort_order: 4 },
    ],
    { onConflict: "profile_id,section_key", ignoreDuplicates: true },
  );
if (sectionsError) throw sectionsError;

console.log(
  JSON.stringify(
    {
      userId,
      userCreated,
      profileId,
      profileCreated,
      status: existingProfile?.status ?? "draft",
      photoPending: true,
      emailContactEnabled: true,
    },
    null,
    2,
  ),
);
