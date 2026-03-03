/**
 * Cria usuários de autenticação (admin e designer) no Supabase Auth
 * e vincula à tabela users.
 *
 * Requer: .env ou .env.local com:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (chave service_role do painel Supabase)
 *
 * Uso: node scripts/create-auth-users.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Variáveis de ambiente necessárias:");
  if (!url) console.error("  - NEXT_PUBLIC_SUPABASE_URL (faltando)");
  if (!serviceKey) console.error("  - SUPABASE_SERVICE_ROLE_KEY (faltando)");
  console.error("");
  console.error(
    "Adicione em .env.local (não commitar):"
  );
  console.error("  NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role");
  console.error("");
  console.error(
    "A chave service_role está em: Supabase Dashboard > Settings > API > service_role"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "123456";

const NAMES_AND_ROLES = [
  { name: "Leonardo Marques", role: "admin" },
  { name: "Valentina Iacovacci", role: "designer" },
];

async function main() {
  console.log("Buscando usuários na tabela users...\n");

  const { data: allUsers, error: fetchError } = await supabase
    .from("users")
    .select("id, name, email, department");

  if (fetchError) {
    console.error("Erro ao buscar usuários:", fetchError.message);
    process.exit(1);
  }

  const toProcess = [];
  for (const { name, role } of NAMES_AND_ROLES) {
    const user = allUsers?.find(
      (u) => u.name && u.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (!user) {
      console.error(`Usuário não encontrado: ${name}`);
      continue;
    }
    if (!user.email || !user.email.trim()) {
      console.error(`${name} não possui e-mail cadastrado. Adicione um e-mail na tabela users.`);
      continue;
    }
    toProcess.push({ ...user, role });
  }

  if (toProcess.length === 0) {
    console.error("Nenhum usuário encontrado para processar.");
    process.exit(1);
  }

  console.log("Criando contas de autenticação...\n");

  for (const u of toProcess) {
    console.log(`Processando: ${u.name} (${u.role}) - ${u.email}`);

    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: u.email.trim(),
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.name },
      });

    if (authError) {
      if (
        authError.message.includes("already been registered") ||
        authError.message.includes("already exists")
      ) {
        console.log(`  Auth já existe: ${u.email}`);
        const { data: listData } = await supabase.auth.admin.listUsers({
          perPage: 100,
        });
        const found = listData?.users?.find(
          (x) => x.email?.toLowerCase() === u.email.trim().toLowerCase()
        );
        if (!found) {
          console.error("  Não foi possível obter usuário existente no Auth.");
          continue;
        }
        await linkUser(found.id, u);
        continue;
      }
      console.error(`  Erro: ${authError.message}`);
      continue;
    }

    console.log(`  Auth criado: ${authUser.user.id}`);
    await linkUser(authUser.user.id, u);
  }

  console.log("\nConcluído. Use o e-mail de cada usuário com a senha: 123456");
}

async function linkUser(authId, user) {
  const { error } = await supabase
    .from("users")
    .update({ auth_id: authId, role: user.role })
    .eq("id", user.id);
  if (error) {
    console.error(`  Erro ao vincular: ${error.message}`);
  } else {
    console.log(`  Usuário vinculado: ${user.id}`);
  }
}

main().catch(console.error);
