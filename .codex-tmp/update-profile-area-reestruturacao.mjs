import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase admin environment is unavailable.");

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const oldArea = "Reestruturação e Insolvência";
const newArea = "Reestruturação";
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { data: current, error: readError } = await db
  .from("professional_profile_localizations")
  .select("profile_id, display_name, practice_area")
  .eq("locale", "pt-BR")
  .eq("practice_area", oldArea)
  .order("display_name");
if (readError) throw readError;

const profileIds = (current ?? []).map((row) => row.profile_id);
if (profileIds.length > 0) {
  const { error: localizationError } = await db
    .from("professional_profile_localizations")
    .update({ practice_area: newArea })
    .eq("locale", "pt-BR")
    .eq("practice_area", oldArea)
    .in("profile_id", profileIds);
  if (localizationError) throw localizationError;

  const { error: auditError } = await db
    .from("professional_profiles")
    .update({ updated_by: actorId })
    .in("id", profileIds);
  if (auditError) throw auditError;
}

console.log(JSON.stringify({
  updated: profileIds.length,
  names: (current ?? []).map((row) => row.display_name),
}));
