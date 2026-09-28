import "dotenv/config";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase admin environment is unavailable.");

const directory = JSON.parse(
  await fs.readFile(
    ".codex-tmp/lista-colaboradores-audit/reconcile-output/current-directory.json",
    "utf8",
  ),
);
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const [{ data: users, error: usersError }, { data: profiles, error: profilesError }] =
  await Promise.all([
    db.from("users").select("id, name, email, is_active, avatar_url"),
    db.from("professional_profiles").select("id, user_id, slug, status"),
  ]);
if (usersError || profilesError) throw usersError ?? profilesError;

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const normalizeName = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const userByEmail = new Map((users ?? []).map((user) => [normalizeEmail(user.email), user]));
const usersByName = new Map();
for (const user of users ?? []) {
  const key = normalizeName(user.name);
  usersByName.set(key, [...(usersByName.get(key) ?? []), user]);
}
const profileByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

const results = directory.map((person) => {
  const emailUser = userByEmail.get(normalizeEmail(person.email)) ?? null;
  const nameCandidates = usersByName.get(normalizeName(person.name)) ?? [];
  const user = emailUser ?? (nameCandidates.length === 1 ? nameCandidates[0] : null);
  const profile = user ? profileByUserId.get(user.id) ?? null : null;
  return {
    ...person,
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    userActive: user?.is_active ?? null,
    avatarUrl: user?.avatar_url ?? null,
    matchedBy: emailUser ? "email" : user ? "unique_name" : null,
    profileId: profile?.id ?? null,
    profileSlug: profile?.slug ?? null,
    profileStatus: profile?.status ?? null,
    outcome: !user
      ? "no_user"
      : !user.is_active
        ? "inactive_user"
        : !profile
          ? "missing_profile"
          : "profile_ok",
  };
});

const counts = results.reduce((acc, row) => {
  acc[row.outcome] = (acc[row.outcome] ?? 0) + 1;
  return acc;
}, {});
const exceptions = results.filter((row) => row.outcome !== "profile_ok");
await fs.writeFile(
  ".codex-tmp/lista-colaboradores-audit/reconcile-output/reconciliation.json",
  JSON.stringify({ counts, results }, null, 2),
  "utf8",
);
console.log(JSON.stringify({ counts, exceptions }, null, 2));
