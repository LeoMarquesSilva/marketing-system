/**
 * Reseta a senha de um usuário no Supabase Auth (requer service_role).
 *
 * Uso: node scripts/reset-password.js <email> [novaSenha]
 * Ex.: node scripts/reset-password.js leonardo.marques@bismarchipires.com.br 123456
 *
 * Requer .env ou .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

// Permite usar SUPABASE_PROJECT_REF=wvbptgcevwvubtnetojz para apontar para outro projeto
const projectRef = process.env.SUPABASE_PROJECT_REF;
const url = projectRef
  ? `https://${projectRef}.supabase.co`
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou .env.local");
  process.exit(1);
}

const listOnly = process.argv[2] === "--list" || process.argv[2] === "-l";
const email = listOnly ? null : process.argv[2];
const newPassword = process.argv[3] || "123456";

if (!email && !listOnly) {
  console.error("Uso: node scripts/reset-password.js <email> [novaSenha]");
  console.error("      node scripts/reset-password.js --list   (lista usuários)");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  if (listOnly) {
    console.log("=== public.users (tabela do app) ===");
    const { data: dbUsers, error: dbErr } = await supabase.from("users").select("id, name, email, auth_id, department").order("email");
    if (dbErr) {
      console.error("Erro:", dbErr.message);
      process.exit(1);
    }
    console.log(dbUsers?.length ? dbUsers : "(nenhum)");
    console.log("\n=== Auth (listUsers) ===");
    const { data: { users: authUsers }, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) {
      console.error("Erro:", authErr.message);
      process.exit(1);
    }
    console.log(authUsers?.length ? authUsers.map((u) => ({ id: u.id, email: u.email })) : "(nenhum)");
    return;
  }

  // 1) Tenta encontrar pelo auth (listUsers)
  let authUserId = null;
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (!listError && users?.length) {
    const u = users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) authUserId = u.id;
  }
  // 2) Se não achou, tenta pela tabela public.users (campo auth_id)
  if (!authUserId) {
    const { data: row, error: dbError } = await supabase
      .from("users")
      .select("auth_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (!dbError && row?.auth_id) authUserId = row.auth_id;
  }
  if (!authUserId) {
    console.error("Usuário não encontrado com o email:", email);
    process.exit(1);
  }
  const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, { password: newPassword });
  if (updateError) {
    console.error("Erro ao atualizar senha:", updateError.message);
    process.exit(1);
  }
  console.log("Senha atualizada com sucesso para:", email);
}

main();
