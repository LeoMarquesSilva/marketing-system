/**
 * Importa usuários do CSV (app_c009c0e4f1_users_rows.csv) para a tabela users
 * Uso: node scripts/import-users.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");
const { parse } = require("csv-parse/sync");
const path = require("path");
const fs = require("fs");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Configure .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const csvPath = path.join(__dirname, "..", "app_c009c0e4f1_users_rows.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("Arquivo não encontrado:", csvPath);
    process.exit(1);
  }
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parse(content, { columns: true, skip_empty_lines: true });

  const users = rows
    .filter((r) => r.name && r.department)
    .map((r) => ({
      id: r.id,
      name: r.name.trim(),
      email: r.email || null,
      department: r.department.trim(),
      avatar_url: r.avatar_url || null,
    }));

  console.log(`Importando ${users.length} usuários...`);

  const { data, error } = await supabase.from("users").upsert(users, {
    onConflict: "id",
    ignoreDuplicates: false,
  }).select();

  if (error) {
    console.error("Erro:", error);
    process.exit(1);
  }
  console.log(`Importados ${users.length} usuários com sucesso.`);
}

main();
