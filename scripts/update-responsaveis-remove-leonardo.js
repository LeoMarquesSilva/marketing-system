/**
 * Remove "Leonardo Marques Silva" da coluna responsaveis em vios_tasks.
 * Uso: node scripts/update-responsaveis-remove-leonardo.js
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

const NOME_ANALISTA_EXCLUIR = "Leonardo Marques Silva";

function filterLeonardoFromResponsaveis(str) {
  if (!str?.trim()) return null;
  const parts = str.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((p) => p !== NOME_ANALISTA_EXCLUIR);
  return filtered.length > 0 ? filtered.join(" | ") : null;
}

async function main() {
  const { data: tasks, error: fetchErr } = await supabase
    .from("vios_tasks")
    .select("vios_id, responsaveis")
    .not("responsaveis", "is", null)
    .ilike("responsaveis", `%${NOME_ANALISTA_EXCLUIR}%`);

  if (fetchErr) {
    console.error("Erro ao buscar tarefas:", fetchErr.message);
    process.exit(1);
  }

  if (!tasks?.length) {
    console.log("Nenhuma tarefa com 'Leonardo Marques Silva' em responsaveis.");
    return;
  }

  console.log(`Encontradas ${tasks.length} tarefa(s) para atualizar.`);

  let updated = 0;
  for (const t of tasks) {
    const novo = filterLeonardoFromResponsaveis(t.responsaveis);
    const { error } = await supabase
      .from("vios_tasks")
      .update({ responsaveis: novo })
      .eq("vios_id", t.vios_id);

    if (error) {
      console.error(`Erro ao atualizar vios_id=${t.vios_id}:`, error.message);
    } else {
      updated++;
      console.log(`  vios_id=${t.vios_id}: "${t.responsaveis}" → "${novo ?? "(null)"}"`);
    }
  }

  console.log(`\nConcluído: ${updated}/${tasks.length} tarefa(s) atualizada(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
