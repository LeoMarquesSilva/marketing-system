/**
 * Atualiza o e-mail de um usuário no Supabase Auth (requer service_role).
 *
 * Uso: node scripts/update-auth-email.js <emailAtual> <novoEmail>
 * Ex.: node scripts/update-auth-email.js leonardo.marques@bpplaw.com.br leonardo.marques@bismarchipires.com.br
 *
 * Requer .env ou .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const projectRef = process.env.SUPABASE_PROJECT_REF;
const url = projectRef
  ? `https://${projectRef}.supabase.co`
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou .env.local");
  process.exit(1);
}

const currentEmail = process.argv[2];
const newEmail = process.argv[3];

if (!currentEmail || !newEmail) {
  console.error("Uso: node scripts/update-auth-email.js <emailAtual> <novoEmail>");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("Erro ao listar usuários:", listError.message);
    process.exit(1);
  }
  const user = users?.find((u) => u.email?.toLowerCase() === currentEmail.toLowerCase());
  if (!user) {
    console.error("Usuário não encontrado com o e-mail:", currentEmail);
    process.exit(1);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { email: newEmail });
  if (updateError) {
    console.error("Erro ao atualizar e-mail:", updateError.message);
    process.exit(1);
  }
  console.log("E-mail atualizado com sucesso:", currentEmail, "->", newEmail);
}

main();
