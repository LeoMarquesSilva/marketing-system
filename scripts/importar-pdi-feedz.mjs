// Importa os PDIs e o gestor direto do Feedz para o ORQESTRAI.
//
// Entrada: JSON exportado pela sessão logada do Feedz (veja docs/feedz/telas-logado.md):
//   { plans: [...], employees: [...] }
//   - plans: /trilhas/gestao/pdi/lista (ativos e finalizados) + /trilhas/{perfil}/trilha/{plano}
//   - employees: /api/empresa/colaboradores (com direct_manager)
//
// Uso:
//   node scripts/importar-pdi-feedz.mjs <arquivo.json>            → simulação (não grava)
//   node scripts/importar-pdi-feedz.mjs <arquivo.json> --gravar   → grava
//
// Regras:
//   - Pessoas: casa pelo e-mail (hr_employees.email ou users.email), depois pelo nome completo.
//   - Gestor direto: só preenche quem está SEM gestor no ORQESTRAI (não sobrescreve ajuste manual).
//   - Planos, frentes e ações: upsert por feedz_id (rodar de novo atualiza, não duplica).
//   - 70-20-10: só quando a própria ação diz "Tipo: 70%/20%/10%". Nada é deduzido.
//   - Descrições e aprendizados entram como texto, do jeito que estão no Feedz.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const [, , file, flag] = process.argv;
if (!file) {
  console.error("Informe o arquivo JSON exportado do Feedz.");
  process.exit(1);
}
const WRITE = flag === "--gravar";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
    })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const data = JSON.parse(fs.readFileSync(file, "utf8"));

const normalize = (value) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);
/**
 * Texto vindo do HTML do Feedz: quebra do código-fonte (linha + recuo) vira espaço, marcador
 * colado no item, um item por linha e no máximo uma linha em branco.
 */
const cleanText = (value) =>
  value
    ? String(value)
        .replace(/\r/g, "")
        .replace(/\n[ \t]{2,}/g, " ")
        .replace(/[ \t]*•[ \t]*\n+[ \t]*/g, "• ")
        .replace(/\n[ \t]+•/g, "\n•")
        .replace(/\n{2,}(?=•)/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim() || null
    : null;

async function must(promise, label) {
  const { data: rows, error } = await promise;
  if (error) {
    console.error(`Falha em ${label}:`, error.message);
    process.exit(1);
  }
  return rows;
}

// --- cadastro do ORQESTRAI -------------------------------------------------
const employees = await must(
  db.from("hr_employees").select("id, full_name, email, user_id, is_active, is_automation, manager_employee_id"),
  "colaboradores"
);
const users = await must(db.from("users").select("id, email"), "usuários");
const userEmail = new Map(users.map((user) => [user.id, normalize(user.email)]));
// bpplaw.com.br e bpp.com.br são domínios antigos do escritório: mesma caixa em bismarchipires.com.br.
const OLD_DOMAINS = new Set(["bpplaw.com.br", "bpp.com.br"]);
function canonEmail(email) {
  const value = normalize(email);
  const at = value.lastIndexOf("@");
  if (at < 0) return value;
  const domain = value.slice(at + 1);
  return OLD_DOMAINS.has(domain) ? `${value.slice(0, at)}@bismarchipires.com.br` : value;
}
const byEmail = new Map();
const byName = new Map();
for (const employee of employees) {
  if (employee.is_automation) continue;
  const emails = new Set(
    [employee.email, employee.user_id ? userEmail.get(employee.user_id) : ""].map(canonEmail).filter(Boolean)
  );
  for (const email of emails) {
    const current = byEmail.get(email);
    // Mesmo e-mail em dois cadastros diferentes = ambíguo (não casa por e-mail).
    byEmail.set(email, current === undefined || current?.id === employee.id ? employee : null);
  }
  const name = normalize(employee.full_name);
  byName.set(name, byName.has(name) ? null : employee); // null = nome repetido (ambíguo)
}

function match(email, name) {
  const viaEmail = byEmail.get(canonEmail(email));
  if (viaEmail) return { employee: viaEmail, how: "e-mail" };
  const viaName = byName.get(normalize(name));
  if (viaName) return { employee: viaName, how: "nome" };
  return { employee: null, how: null };
}

// --- pessoas do Feedz ------------------------------------------------------
const feedzToHr = new Map();
const unmatchedPeople = [];
for (const person of data.employees ?? []) {
  const { employee } = match(person.email, person.name);
  if (employee) feedzToHr.set(person.id, employee);
  else unmatchedPeople.push(`${person.name} <${person.email ?? "sem e-mail"}> (status ${person.status})`);
}

// --- gestor direto ---------------------------------------------------------
const managerUpdates = [];
const managerConflicts = [];
const plannedManager = new Map(employees.map((employee) => [employee.id, employee.manager_employee_id]));
const decided = new Set();
// Perfil desligado no Feedz (status 2) fica por último: se a mesma pessoa tem um perfil ativo, vale o ativo.
const feedzOrdered = [...(data.employees ?? [])].sort((a, b) => Number(a.status === 2) - Number(b.status === 2));
for (const person of feedzOrdered) {
  const employee = feedzToHr.get(person.id);
  if (!employee || !person.id_manager || decided.has(employee.id)) continue;
  decided.add(employee.id);
  const manager = feedzToHr.get(person.id_manager);
  if (!manager || manager.id === employee.id) continue;
  if (employee.manager_employee_id && employee.manager_employee_id !== manager.id) {
    managerConflicts.push(`${employee.full_name}: ORQESTRAI já tem outro gestor; Feedz diz ${manager.full_name}`);
    continue;
  }
  if (employee.manager_employee_id === manager.id) continue;
  managerUpdates.push({ id: employee.id, name: employee.full_name, manager_id: manager.id, manager_name: manager.full_name });
  plannedManager.set(employee.id, manager.id);
}
// Evita ciclo (A gestor de B e B gestor de A).
function hasCycle(startId) {
  const seen = new Set();
  let current = plannedManager.get(startId);
  while (current) {
    if (current === startId || seen.has(current)) return true;
    seen.add(current);
    current = plannedManager.get(current);
  }
  return false;
}
const safeManagerUpdates = managerUpdates.filter((update) => !hasCycle(update.id));

// --- tipos -----------------------------------------------------------------
const types = await must(db.from("hr_pdi_types").select("id, name"), "tipos");
const TYPE_ALIASES = {
  "desenvolvimento de competencias comportamentais e tecnicas": "competencias comportamentais e tecnicas",
};
function typeId(feedzName) {
  if (!feedzName) return null;
  const wanted = TYPE_ALIASES[normalize(feedzName)] ?? normalize(feedzName);
  return types.find((type) => normalize(type.name) === wanted)?.id ?? null;
}

function learningKind(description) {
  const found = (description ?? "").match(/Tipo:\s*(70|20|10)\s*%/i);
  return found ? { 70: "pratica", 20: "troca", 10: "formal" }[found[1]] : null;
}

// --- planos ----------------------------------------------------------------
const planRows = [];
const unmatchedPlans = [];
for (const plan of data.plans ?? []) {
  const { employee, how } = match(plan.profile?.email, plan.profile?.name);
  if (!employee) {
    unmatchedPlans.push(`${plan.profile?.name} — ${plan.name}`);
    continue;
  }
  const manager = plan.profile?.id_manager ? feedzToHr.get(plan.profile.id_manager) : null;
  const start = dateOnly(plan.dt_start);
  let due = dateOnly(plan.dt_finish) ?? start;
  if (due < start) due = start;
  planRows.push({ plan, employee, how, manager, start, due });
}

console.log("\n=== Importação do Feedz", WRITE ? "(GRAVANDO)" : "(simulação)", "===");
console.log(`Pessoas do Feedz: ${data.employees?.length ?? 0} · ligadas ao cadastro: ${feedzToHr.size}`);
if (unmatchedPeople.length) console.log("Sem correspondência no cadastro:\n  - " + unmatchedPeople.join("\n  - "));
console.log(`Gestor direto a preencher: ${safeManagerUpdates.length} (ignorados por ciclo: ${managerUpdates.length - safeManagerUpdates.length})`);
if (managerConflicts.length) console.log("Mantidos (já tinham outro gestor):\n  - " + managerConflicts.join("\n  - "));
console.log(`Planos: ${data.plans?.length ?? 0} · ligados: ${planRows.length}`);
if (unmatchedPlans.length) console.log("Planos sem colaborador:\n  - " + unmatchedPlans.join("\n  - "));
const taskCount = planRows.reduce((total, row) => total + row.plan.groups.reduce((sum, group) => sum + group.tasks.length, 0), 0);
console.log(`Frentes: ${planRows.reduce((total, row) => total + row.plan.groups.length, 0)} · ações: ${taskCount}`);
console.log(`Ações com 70-20-10 explícito: ${planRows.reduce((total, row) => total + row.plan.groups.reduce((sum, group) => sum + group.tasks.filter((task) => learningKind(task.description)).length, 0), 0)}`);

if (!WRITE) {
  console.log("\nNada foi gravado. Rode com --gravar para importar.");
  process.exit(0);
}

// --- gravação --------------------------------------------------------------
for (const update of safeManagerUpdates) {
  await must(db.from("hr_employees").update({ manager_employee_id: update.manager_id }).eq("id", update.id), `gestor de ${update.name}`);
}

for (const { plan, employee, manager, start, due } of planRows) {
  const [saved] = await must(
    db
      .from("hr_pdi_plans")
      .upsert(
        {
          feedz_id: plan.feedz_id,
          employee_id: employee.id,
          manager_employee_id: manager && manager.id !== employee.id ? manager.id : null,
          type_id: typeId(plan.pdi_type),
          title: plan.name.trim().slice(0, 200),
          origin: "feedz",
          origin_label: "Feedz",
          start_date: start,
          due_date: due,
          status: plan.is_finished ? "concluido" : "ativo",
          completed_at: plan.is_finished ? plan.finished_at ?? null : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "feedz_id" }
      )
      .select("id"),
    `plano ${plan.name}`
  );
  for (const group of plan.groups) {
    const [goal] = await must(
      db
        .from("hr_pdi_goals")
        .upsert(
          {
            feedz_id: group.feedz_id,
            plan_id: saved.id,
            title: (group.name || "Frente").trim().slice(0, 200),
            description: cleanText(group.description)?.slice(0, 4000) ?? null,
            sort_order: group.sequence ?? 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "feedz_id" }
        )
        .select("id"),
      `frente ${group.name}`
    );
    const actions = group.tasks.map((task) => {
      const progress = Math.max(0, Math.min(100, Math.round(Number(task.status) || 0)));
      return {
        feedz_id: task.feedz_id,
        plan_id: saved.id,
        goal_id: goal.id,
        title: (task.name || "Ação").trim().slice(0, 300),
        description: cleanText(task.description)?.slice(0, 8000) ?? null,
        learning_kind: learningKind(task.description),
        learnings: cleanText(task.learning)?.slice(0, 8000) ?? null,
        due_date: dateOnly(task.dt_to_realize),
        progress,
        completed_at: progress >= 100 ? task.finish_date ?? null : null,
        last_update_at: task.finish_date ?? null,
        sort_order: task.step ?? 0,
        updated_at: new Date().toISOString(),
      };
    });
    if (actions.length) {
      await must(db.from("hr_pdi_actions").upsert(actions, { onConflict: "feedz_id" }), `ações de ${group.name}`);
    }
  }
  const existing = await must(
    db.from("hr_pdi_activity").select("id").eq("plan_id", saved.id).eq("kind", "criacao").limit(1),
    "histórico"
  );
  if (!existing.length) {
    await must(
      db.from("hr_pdi_activity").insert({ plan_id: saved.id, kind: "criacao", body: "Importado do Feedz", created_at: plan.dt_start }),
      "histórico"
    );
  }
}

console.log("\nImportação concluída.");
