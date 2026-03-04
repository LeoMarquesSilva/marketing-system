/**
 * Remove do Planner todas as tarefas VIOS que foram promovidas (voltam para "Tarefas VIOS").
 * Use quando tarefas foram enviadas ao Planner indevidamente (ex.: por import antigo).
 *
 * Uso: node scripts/unpromote-vios-from-planner.js [--dry-run]
 * --dry-run: apenas lista o que seria removido, sem alterar
 *
 * Requer: .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou anon)
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou ANON_KEY) no .env");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const supabase = createClient(url, key);

async function main() {
  const { data: viosLinked, error: viosErr } = await supabase
    .from("vios_tasks")
    .select("vios_id, marketing_request_id")
    .not("marketing_request_id", "is", null);

  if (viosErr) {
    console.error("Erro ao buscar vios_tasks:", viosErr.message);
    process.exit(1);
  }

  const toUnpromote = viosLinked || [];
  if (toUnpromote.length === 0) {
    console.log("Nenhuma tarefa VIOS vinculada ao Planner.");
    return;
  }

  const mrIds = [...new Set(toUnpromote.map((t) => t.marketing_request_id).filter(Boolean))];
  const { data: mrs, error: mrErr } = await supabase
    .from("marketing_requests")
    .select("id, title")
    .in("id", mrIds);

  if (mrErr) {
    console.error("Erro ao buscar marketing_requests:", mrErr.message);
    process.exit(1);
  }

  console.log(`Tarefas VIOS vinculadas ao Planner: ${toUnpromote.length}`);
  (mrs || []).forEach((mr) => console.log(`  - ${mr.id}: ${mr.title}`));

  if (dryRun) {
    console.log("\n[DRY-RUN] Nada foi alterado. Execute sem --dry-run para aplicar.");
    return;
  }

  for (const t of toUnpromote) {
    const { error: upErr } = await supabase
      .from("vios_tasks")
      .update({ marketing_request_id: null, updated_at: new Date().toISOString() })
      .eq("vios_id", t.vios_id);
    if (upErr) {
      console.error("Erro ao desvincular vios_id", t.vios_id, upErr.message);
      continue;
    }
  }

  for (const id of mrIds) {
    const { error: delErr } = await supabase.from("marketing_requests").delete().eq("id", id);
    if (delErr) {
      console.error("Erro ao excluir marketing_request", id, delErr.message);
    }
  }

  console.log(`\nConcluído: ${toUnpromote.length} tarefas voltaram para Tarefas VIOS.`);
  console.log("Use o botão 'Enviar ao Planner' na aba Tarefas VIOS para promover as que desejar.");
}

main();
