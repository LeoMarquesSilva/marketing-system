import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase configuration is missing.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const accountEmail = "controladoria@bpplaw.com.br";
const directoryEmail = "samuel@bismarchipires.com.br";

const { data: importResult, error: importError } = await supabase.rpc(
  "apply_professional_profile_import",
  {
    p_rows: [
      {
        email: accountEmail,
        name: "Samuel Willian Silva",
        slug: "samuel-willian-silva",
        role: "Coordenador(a)",
        area: "Operações Legais",
        phone: "(35) 99236-6669",
        joinedOn: "2021-03-19",
        overwrite: false,
      },
    ],
    p_actor_id: actorId,
  },
);

if (importError) throw importError;

const { data: user, error: userError } = await supabase
  .from("users")
  .select("id")
  .eq("email", accountEmail)
  .single();

if (userError) throw userError;

const { error: profileError } = await supabase
  .from("professional_profiles")
  .update({ professional_email: directoryEmail, updated_by: actorId })
  .eq("user_id", user.id);

if (profileError) throw profileError;

console.log(JSON.stringify({ importResult, profile: "Samuel Willian Silva" }, null, 2));
