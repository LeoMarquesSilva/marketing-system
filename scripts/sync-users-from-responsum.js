/**
 * Sincroniza usuários do Supabase Responsum (app_c009c0e4f1_users)
 * para a tabela users do Marketing System.
 *
 * Requer em .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL          — projeto Marketing
 *   SUPABASE_SERVICE_ROLE_KEY         — service role Marketing
 *   RESPONSUM_SUPABASE_URL            — projeto Responsum
 *   RESPONSUM_SUPABASE_SERVICE_KEY    — service role Responsum
 *
 * Uso: node scripts/sync-users-from-responsum.js
 *      node scripts/sync-users-from-responsum.js --dry-run
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const dryRun = process.argv.includes("--dry-run");

const mktUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const mktKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const respUrl = process.env.RESPONSUM_SUPABASE_URL;
const respKey = process.env.RESPONSUM_SUPABASE_SERVICE_KEY;

if (!mktUrl || !mktKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!respUrl || !respKey) {
  console.error("Configure RESPONSUM_SUPABASE_URL e RESPONSUM_SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const mkt = createClient(mktUrl, mktKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const resp = createClient(respUrl, respKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SKIP_NAME = /usuário excluído|^teste$/i;

/** IDs com configuração local que não deve ser sobrescrita pelo Responsum */
const PRESERVE_LOCAL = new Set([
  "2f08c695-770e-47ce-b4e4-ce27fa414df8", // Leonardo Marques (admin local)
  "73b4ed1a-6adf-4f61-9f5d-3fcce646d6b7", // Valentina (designer + auth)
]);

/** Duplicatas antigas no Marketing a desativar quando o ID correto do Responsum for inserido */
const DEACTIVATE_ON_SYNC = {
  "ed825db7-e2cc-4e67-9291-b701a12c0ddb": "0f37e7b9-56d4-4baf-a7a2-ea016a7b9ac3", // Andressa
  "b4de2148-920a-4b22-a08f-6bba0f53dae7": "f319df01-1c09-4d76-901b-2bba2b7f483c", // Letícia recepção
};

function esc(v) {
  if (v == null) return null;
  return String(v).trim();
}

async function main() {
  const { data: source, error: srcErr } = await resp
    .from("app_c009c0e4f1_users")
    .select("id, name, email, department, avatar_url, is_active")
    .not("name", "is", null)
    .not("department", "is", null);

  if (srcErr) {
    console.error("Erro ao buscar Responsum:", srcErr.message);
    process.exit(1);
  }

  const { data: existing, error: mktErr } = await mkt
    .from("users")
    .select("id, name, email, department, avatar_url, is_active, role, auth_id, permissions");

  if (mktErr) {
    console.error("Erro ao buscar Marketing:", mktErr.message);
    process.exit(1);
  }

  const byId = new Map((existing ?? []).map((u) => [u.id, u]));
  const byEmail = new Map(
    (existing ?? []).filter((u) => u.email).map((u) => [u.email.toLowerCase(), u])
  );

  const filtered = (source ?? []).filter((u) => !SKIP_NAME.test(u.name));
  const toUpsert = [];
  const toDeactivate = [];

  for (const r of filtered) {
    const row = {
      id: r.id,
      name: esc(r.name),
      email: esc(r.email) || null,
      department: esc(r.department),
      avatar_url: r.avatar_url || null,
      is_active: r.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    if (PRESERVE_LOCAL.has(r.id)) continue;

    const dupEmail = row.email ? byEmail.get(row.email.toLowerCase()) : null;
    if (dupEmail && dupEmail.id !== r.id && dupEmail.auth_id) {
      // Mantém registro com auth; só atualiza dados básicos sem trocar ID
      continue;
    }

    toUpsert.push(row);

    const oldId = DEACTIVATE_ON_SYNC[r.id];
    if (oldId && byId.has(oldId)) {
      toDeactivate.push(oldId);
    }
  }

  const inserted = toUpsert.filter((u) => !byId.has(u.id));
  const updated = toUpsert.filter((u) => {
    const cur = byId.get(u.id);
    if (!cur) return false;
    return (
      cur.name !== u.name ||
      (cur.email || "") !== (u.email || "") ||
      cur.department !== u.department ||
      (cur.avatar_url || "") !== (u.avatar_url || "") ||
      (cur.is_active ?? true) !== u.is_active
    );
  });

  console.log(`Responsum: ${filtered.length} usuários válidos`);
  console.log(`Marketing: ${existing?.length ?? 0} usuários`);
  console.log(`Novos: ${inserted.length}`);
  console.log(`Atualizar: ${updated.length}`);
  console.log(`Desativar duplicatas: ${toDeactivate.length}`);

  if (inserted.length) {
    console.log("\nNovos:");
    inserted.forEach((u) => console.log(`  + ${u.name} (${u.department})`));
  }

  if (updated.length) {
    console.log("\nAtualizações:");
    updated.forEach((u) => console.log(`  ~ ${u.name}`));
  }

  if (dryRun) {
    console.log("\n[dry-run] Nenhuma alteração aplicada.");
    return;
  }

  if (toUpsert.length) {
    const { error } = await mkt.from("users").upsert(toUpsert, { onConflict: "id" });
    if (error) {
      console.error("Erro no upsert:", error.message);
      process.exit(1);
    }
  }

  if (toDeactivate.length) {
    const { error } = await mkt
      .from("users")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", toDeactivate);
    if (error) {
      console.error("Erro ao desativar duplicatas:", error.message);
      process.exit(1);
    }
  }

  // Atualiza registros com auth vinculado (sem trocar ID)
  for (const r of filtered) {
    if (!PRESERVE_LOCAL.has(r.id)) continue;
    const cur = byId.get(r.id);
    if (!cur) continue;
    const { error } = await mkt
      .from("users")
      .update({
        name: esc(r.name),
        email: esc(r.email) || cur.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) console.warn(`Aviso ao atualizar ${r.name}:`, error.message);
  }

  console.log("\nSincronização concluída.");
}

main();
