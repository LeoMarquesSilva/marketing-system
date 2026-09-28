import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase admin environment is unavailable.");

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const updates = [
  ["76499bc5-a8d2-4987-bb9a-dfbdd7941014", "https://www.linkedin.com/in/daniela-lagoeiro"],
  ["9f06a506-17fb-4917-8d6e-14e6c57a46bb", "https://www.linkedin.com/in/ananunesgalvao/"],
  ["11bf82a9-0c64-4564-9401-8327c17cbc4b", "https://www.linkedin.com/in/leonardomarquessilva/"],
  ["d8c6135e-a9ca-4117-aaa4-3457c4268301", "https://www.linkedin.com/in/andressa-silva-a657381ba/"],
  ["d9a4b79b-64bb-459a-8552-d6643597fc09", "https://www.linkedin.com/in/caio-augusto-de-alc%C3%A2ntara-c%C3%A9sar-silva-710233286/"],
  ["9761abfe-ae3f-4b2a-bb59-5abb72ae974c", "https://www.linkedin.com/in/francisco-zanin-57022873/"],
  ["d01735a9-216e-4b17-8459-caa0c4bd06ae", "https://www.linkedin.com/in/gabriella-assump%C3%A7%C3%A3o-21b6a7175/"],
  ["a6c8718e-6671-4c4e-9fc9-01db2012fc7c", "https://www.linkedin.com/in/graziane-mauch-de-brito-aa14b7b3/"],
  ["df75b9df-9c34-4755-aefb-b0392dea151b", "https://www.linkedin.com/in/henrique-nascimento-434967131/"],
  ["4891efc7-7984-478f-a704-ebe5d93730a0", "https://www.linkedin.com/in/juliana-herculano-109b45212/"],
  ["a61ee8f1-10e2-4104-9ee3-31797f33f79e", "https://www.linkedin.com/in/laura-puente-ferreira-gomes-6b508636a/"],
  ["49815490-0a4f-46cf-95cf-e7fb6a3ddd3e", "https://www.linkedin.com/in/manoela-b-500147336/"],
  ["60a1c5f6-4d75-4ed7-8828-397f2268bd72", "https://www.linkedin.com/in/maria-j%C3%BAlia-pereira-7a591631b/"],
  ["1ee68c5f-46dd-4911-bb2b-0ac7c3df854f", "https://www.linkedin.com/in/marina-pinelli-b77787326/"],
  ["2685f14e-6de4-49d6-8e57-f27e55d7717d", "https://www.linkedin.com/in/valentina-iacovacci-4255a02bb/"],
];

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const results = [];
for (const [id, linkedinUrl] of updates) {
  const { data, error } = await db
    .from("professional_profiles")
    .update({ linkedin_url: linkedinUrl, show_linkedin: true, updated_by: actorId })
    .eq("id", id)
    .select("id, linkedin_url")
    .maybeSingle();
  if (error) throw new Error(`Failed profile ${id}: ${error.message}`);
  results.push({ id, updated: Boolean(data), linkedinUrl: data?.linkedin_url ?? null });
}

console.log(JSON.stringify({ updated: results.filter((item) => item.updated).length, results }));
