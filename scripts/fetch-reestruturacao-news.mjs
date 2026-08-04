/**
 * Busca notícias frescas do tema Reestruturação (Insolvência).
 * Uso: node --import tsx scripts/fetch-reestruturacao-news.mjs
 *   ou: npx tsx scripts/fetch-reestruturacao-news.mjs
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env" });
config({ path: ".env.local" });

const TOPIC_ID = "7777ae18-7634-439f-8de1-fa905430c36a";
const TARGET = Number(process.env.FETCH_TARGET ?? 15);

async function main() {
  const { runFetchPipeline } = await import("../src/lib/content-roteiros.ts");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam credenciais Supabase");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("content_topics")
    .select("id, name, rss_query, legal_area, is_active, months_back, item_limit, created_at")
    .eq("id", TOPIC_ID)
    .single();

  if (error || !data) throw new Error(error?.message ?? "tema não encontrado");

  // Amplia só nesta execução (não altera o banco) para achar mais candidatas novas.
  const topic = {
    ...data,
    item_limit: 60,
    months_back: 4,
  };

  console.log(`Buscando até ${TARGET} notícias novas para: ${topic.name}`);
  const result = await runFetchPipeline(undefined, [topic], {
    maxCreated: TARGET,
    trigger: "manual",
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.created < TARGET) {
    console.log(
      `Aviso: só ${result.created}/${TARGET} novas (restante já existia ou foi filtrado).`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
