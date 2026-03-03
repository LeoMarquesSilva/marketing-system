/**
 * Verifica estado do banco: users (auth_id, role) e marketing_requests (assignee_id)
 * Uso: node scripts/check-db.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("=== USUÁRIOS (users) ===\n");

  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, name, email, department, role, auth_id")
    .order("name");

  if (usersErr) {
    console.error("Erro users:", usersErr.message);
    return;
  }

  for (const u of users || []) {
    const authOk = u.auth_id ? "✓" : "✗ SEM auth_id";
    const roleOk = u.role ? `role=${u.role}` : "role vazio";
    console.log(`${u.name} | dept=${u.department} | ${roleOk} | ${authOk}`);
  }

  console.log("\n=== MARKETING_REQUESTS (assignee_id, solicitante_id) ===\n");

  const { data: requests, error: reqErr } = await supabase
    .from("marketing_requests")
    .select("id, title, assignee_id, solicitante_id, workflow_stage")
    .order("requested_at", { ascending: false })
    .limit(20);

  if (reqErr) {
    console.error("Erro marketing_requests:", reqErr.message);
    return;
  }

  const userIdToName = (users || []).reduce((acc, u) => {
    acc[u.id] = u.name;
    return acc;
  }, {});

  for (const r of requests || []) {
    const assignee = r.assignee_id ? userIdToName[r.assignee_id] || r.assignee_id : "—";
    const solicitante = r.solicitante_id ? userIdToName[r.solicitante_id] || r.solicitante_id : "—";
    console.log(`${r.title?.slice(0, 40)}... | assignee: ${assignee} | solicitante: ${solicitante}`);
  }

  const valentina = (users || []).find((u) => u.name?.toLowerCase().includes("valentina"));
  if (valentina) {
    console.log("\n=== VALENTINA (designer) ===");
    console.log("id:", valentina.id);
    console.log("auth_id:", valentina.auth_id || "NÃO VINCULADO");
    console.log("role:", valentina.role || "vazio");
    const herTasks = (requests || []).filter((r) => r.assignee_id === valentina.id);
    console.log("Tarefas atribuídas a ela:", herTasks.length);
  }
}

main().catch(console.error);
