/**
 * Script para definir "Valentina Iacovacci" como responsável de todas as solicitações
 * Uso: node scripts/update-assignee.js
 * Requer: .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Configure .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const ASSIGNEE = "Valentina Iacovacci";

async function main() {
  const { data: ids } = await supabase
    .from("marketing_requests")
    .select("id");

  if (!ids?.length) {
    console.log("Nenhuma solicitação encontrada.");
    return;
  }

  const { data, error } = await supabase
    .from("marketing_requests")
    .update({ assignee: ASSIGNEE })
    .in("id", ids.map((r) => r.id))
    .select("id");

  if (error) {
    console.error("Erro ao atualizar:", error.message);
    process.exit(1);
  }

  console.log(`Atualizadas ${data?.length ?? 0} solicitações com responsável "${ASSIGNEE}"`);
}

main();
