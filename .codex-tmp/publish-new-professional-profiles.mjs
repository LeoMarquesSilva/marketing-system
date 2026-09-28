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
const slugs = [
  "giovanna-pereira-de-souza",
  "maria-heloiza-gois-ponce",
  "samuel-willian-silva",
  "vinicius-canto-hecksher",
];
const publishedAt = new Date().toISOString();

const { data, error } = await supabase
  .from("professional_profiles")
  .update({
    status: "published",
    published_at: publishedAt,
    updated_by: actorId,
  })
  .in("slug", slugs)
  .select("slug, status, published_at");

if (error) throw error;
if (data.length !== slugs.length) {
  throw new Error(`Expected to publish ${slugs.length} profiles, updated ${data.length}.`);
}

console.log(
  JSON.stringify(
    {
      published: data.length,
      slugs: data.map((profile) => profile.slug).sort(),
    },
    null,
    2,
  ),
);
