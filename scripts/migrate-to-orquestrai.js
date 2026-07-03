/**
 * Copia dados do projeto Supabase antigo (Free) para ORQESTRAI (Pro).
 *
 * Requer no .env:
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (origem)
 *   NEXT_PUBLIC_SUPABASE_URL_ORQUESTRAI + SUPABASE_SERVICE_ROLE_KEY_ORQUESTRAI (destino)
 *   ou usa URL fixa do ORQESTRAI se só a key estiver definida
 *
 * Uso: node scripts/migrate-to-orquestrai.js
 *      node scripts/migrate-to-orquestrai.js --dry-run
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const dryRun = process.argv.includes("--dry-run");

const sourceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL_ORQUESTRAI ||
  "https://qwihfvagemzlyypeohpc.supabase.co";
const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY_ORQUESTRAI;

if (!sourceUrl || !sourceKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (origem)");
  process.exit(1);
}
if (!targetKey) {
  console.error("Configure SUPABASE_SERVICE_ROLE_KEY_ORQUESTRAI");
  process.exit(1);
}

const source = createClient(sourceUrl, sourceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const target = createClient(targetUrl, targetKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Ordem respeitando FKs (pais antes dos filhos) */
const TABLE_ORDER = [
  "areas",
  "request_types",
  "app_settings",
  "users",
  "profiles",
  "content_topics",
  "clima_todos",
  "due_diligence_leads",
  "event_suppliers",
  "event_templates",
  "infra_services",
  "infra_project_profiles",
  "marketing_requests",
  "vios_tasks",
  "due_diligence_areas",
  "content_roteiros",
  "events",
  "event_template_tasks",
  "event_tasks",
  "event_budget_items",
  "event_communications",
  "event_invites",
  "event_supplier_quotes",
  "event_supplier_event_usage",
  "event_attachments",
  "event_postmortems",
  "event_history",
  "marketing_request_checklist_items",
  "request_comments",
  "request_activity_log",
  "time_entries",
  "instagram_posts",
  "instagram_stories",
  "instagram_account_stats",
  "instagram_account_insights",
  "instagram_demographics",
  "whatsapp_conversations",
  "whatsapp_messages",
  "whatsapp_webhook_events",
  "content_fetch_runs",
  "supabase_billing_history",
  "infra_service_payments",
];

const PAGE = 500;

async function fetchAll(client, table) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} read: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function upsertBatch(table, rows) {
  if (!rows.length) return;
  const { error } = await target.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

async function upsertByConflict(table, rows, onConflict) {
  if (!rows.length) return;
  const opts = onConflict ? { onConflict } : undefined;
  const { error } = await target.from(table).upsert(rows, opts);
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

const CONFLICT_KEYS = {
  areas: "name",
  request_types: "id",
  app_settings: "key",
  infra_services: "slug",
  infra_project_profiles: "project_ref",
  vios_tasks: "vios_id",
  instagram_posts: "ig_media_id",
  instagram_stories: "ig_story_id",
  instagram_account_insights: "date",
  whatsapp_conversations: "instance_name,remote_jid",
  whatsapp_messages: "instance_name,wa_message_id",
  event_templates: "slug",
  events: "year,name",
};

async function copyTable(table) {
  const rows = await fetchAll(source, table);
  console.log(`  ${table}: ${rows.length} linhas`);
  if (dryRun || !rows.length) return;

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const onConflict = CONFLICT_KEYS[table] || "id";
    await upsertByConflict(table, chunk, onConflict);
  }
}

async function copyAuthUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await source.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`auth list: ${error.message}`);
    users.push(...(data.users || []));
    if (!data.users?.length || data.users.length < 200) break;
    page += 1;
  }
  console.log(`  auth.users: ${users.length} usuários`);
  if (dryRun) return;

  for (const user of users) {
    const payload = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      email_confirm: true,
      phone_confirm: !!user.phone,
      user_metadata: user.user_metadata || {},
      app_metadata: user.app_metadata || {},
    };
    const { error } = await target.auth.admin.createUser(payload);
    if (error && !/already|exists|registered|duplicate/i.test(error.message)) {
      console.warn(`    auth skip ${user.email}: ${error.message}`);
    }
  }
}

async function main() {
  console.log("Origem:", sourceUrl);
  console.log("Destino:", targetUrl);
  if (dryRun) console.log("DRY RUN — nenhuma escrita\n");

  console.log("\n1) Auth (usuários de login) — antes de profiles");
  await copyAuthUsers();

  console.log("\n2) Tabelas public.*");
  for (const table of TABLE_ORDER) {
    await copyTable(table);
  }

  console.log("\nConcluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
