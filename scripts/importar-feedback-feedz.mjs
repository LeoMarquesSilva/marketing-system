// Importa o histórico de Feedbacks do Feedz para o ORQESTRAI (hr_feedbacks + hr_feedback_replies).
//
// Entrada: JSON montado na sessão logada do Feedz (admin):
//   {
//     feedbacks: [...]   → GET /api/gestao/feedbacks/historico?page=N&rowsPerPage=100&dt_start=01012018&dt_end=31122027
//                          (message em HTML, custom_details = notas por valor, offline = presencial, dt_read, threads = respostas)
//     employees: [...]   → GET /api/empresa/colaboradores?page=N (id, name, email) — o histórico não traz e-mail
//   }
//
// Uso:
//   node scripts/importar-feedback-feedz.mjs <arquivo.json>            → simulação (não grava)
//   node scripts/importar-feedback-feedz.mjs <arquivo.json> --gravar   → grava
//
// Regras (decisões de 23/11/2026, docs/feedz/proposta-feedback.md):
//   - Pessoas casadas pelo e-mail (cadastro ou usuário), depois pelo nome completo.
//   - Upsert por feedz_id: rodar de novo atualiza, não duplica. Respostas com feedz_id = id do feedback × 100 + posição.
//   - Tipo: as entregas de Boas práticas (enviadas pela Andressa, sem nota) viram "boa_pratica" e são ligadas ao
//     registro de /rh/boas-praticas quando há um só registro do mesmo gestor com a mesma data de envio. O resto é "sem_tipo".
//   - Notas por valor ficam em value_ratings (histórico); os valores avaliados viram as etiquetas CIVIL.
//   - Visibilidade "privado" (o Feedz não tinha escolha); nenhum aviso é disparado.

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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const normalize = (value) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
/** Horário do Feedz é de Brasília (sem horário de verão desde 2019). */
const fromFeedzStamp = (value) => (value ? `${String(value).slice(0, 10)}T${String(value).slice(11, 19) || "00:00:00"}-03:00` : null);

const ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•" };
function htmlToText(value) {
  if (!value) return "";
  let text = String(value)
    .replace(/\r/g, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|blockquote)\s*>/gi, "\n")
    .replace(/<\s*(p|div|h[1-6]|tr|blockquote|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[(?:end)?if[^\]]*\]>/gi, "");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n•\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function must(promise, label) {
  const { data: rows, error } = await promise;
  if (error) {
    console.error(`Falha em ${label}:`, error.message);
    process.exit(1);
  }
  return rows;
}

// --- cadastro do ORQESTRAI -------------------------------------------------
const employees = await must(db.from("hr_employees").select("id, full_name, email, user_id, is_automation"), "colaboradores");
const users = await must(db.from("users").select("id, email"), "usuários");
const userEmail = new Map(users.map((user) => [user.id, normalize(user.email)]));
const OLD_DOMAINS = new Set(["bpplaw.com.br", "bpp.com.br"]);
const canonEmail = (email) => {
  const value = normalize(email);
  const at = value.lastIndexOf("@");
  if (at < 0) return value;
  return OLD_DOMAINS.has(value.slice(at + 1)) ? `${value.slice(0, at)}@bismarchipires.com.br` : value;
};
const byEmail = new Map();
const byName = new Map();
for (const employee of employees) {
  if (employee.is_automation) continue;
  for (const email of new Set([employee.email, employee.user_id ? userEmail.get(employee.user_id) : ""].map(canonEmail).filter(Boolean))) {
    const current = byEmail.get(email);
    byEmail.set(email, current === undefined || current?.id === employee.id ? employee : null);
  }
  const name = normalize(employee.full_name);
  byName.set(name, byName.has(name) ? null : employee);
}
const feedzPeople = new Map((data.employees ?? []).map((person) => [person.id, person]));
const resolved = new Map();
const unmatched = new Map();
function hrOf(profile) {
  if (!profile?.id) return null;
  if (resolved.has(profile.id)) return resolved.get(profile.id);
  const full = feedzPeople.get(profile.id);
  const employee = byEmail.get(canonEmail(full?.email)) || byName.get(normalize(full?.name ?? profile.name)) || null;
  resolved.set(profile.id, employee);
  if (!employee) unmatched.set(profile.id, `${full?.name ?? profile.name} <${full?.email ?? "sem e-mail"}>`);
  return employee;
}

// --- valores CIVIL ----------------------------------------------------------
const VALUE_KEYS = [
  ["cliente", "cliente no centro"],
  ["inovacao", "inovacao constante"],
  ["valorizacao", "valorizacao das pessoas"],
  ["inteligencia", "inteligencia em resultados"],
  ["liberdade", "liberdade para criar"],
];
function ratingsOf(raw) {
  if (!raw || raw === "[]" || raw === "{}") return null;
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const entries = Object.entries(parsed).filter(([, value]) => Number(value) > 0);
  return entries.length ? Object.fromEntries(entries.map(([key, value]) => [key, Number(value)])) : null;
}
function valuesOf(ratings) {
  if (!ratings) return [];
  const labels = Object.keys(ratings).map(normalize);
  return VALUE_KEYS.filter(([, label]) => labels.some((key) => key.includes(label))).map(([key]) => key);
}

// --- Boas práticas: ligar ao registro ---------------------------------------
const goodPractices = await must(db.from("hr_good_practice_feedbacks").select("id, manager_employee_id, sent_on, employee_name, is_team"), "boas práticas");
const alreadyLinked = new Set((await must(db.from("hr_feedbacks").select("good_practice_id, feedz_id").not("good_practice_id", "is", null), "ligações")).filter((row) => !row.feedz_id).map((row) => row.good_practice_id));
const usedGoodPractice = new Set(alreadyLinked);
const isGoodPracticeSender = (profile) => normalize(profile?.name).startsWith("andressa silva");

// --- montar ------------------------------------------------------------------
const rows = [];
const replies = [];
const skipped = [];
let linked = 0;
for (const item of data.feedbacks ?? []) {
  const from = hrOf(item.profile_from);
  const to = hrOf(item.profile_to);
  const label = `${item.profile_from?.name ?? "?"} → ${item.profile_to?.name ?? "?"} em ${String(item.dt_feedback).slice(0, 10)}`;
  if (!from || !to) {
    skipped.push(`${label}: pessoa sem cadastro no ORQESTRAI`);
    continue;
  }
  if (from.id === to.id) {
    skipped.push(`${label}: remetente e destinatário são a mesma pessoa`);
    continue;
  }
  const message = htmlToText(item.message) || htmlToText(item.simple_text_message);
  if (!message) {
    skipped.push(`${label}: sem texto`);
    continue;
  }
  const ratings = ratingsOf(item.custom_details);
  const isGoodPractice = isGoodPracticeSender(item.profile_from) && !ratings;
  let goodPracticeId = null;
  if (isGoodPractice) {
    const day = String(item.dt_feedback).slice(0, 10);
    const free = goodPractices.filter((gp) => gp.manager_employee_id === to.id && !usedGoodPractice.has(gp.id));
    let candidates = free.filter((gp) => gp.sent_on === day);
    if (candidates.length !== 1) {
      // Mesmo gestor, até 3 dias de diferença e o primeiro nome da pessoa (ou "equipe") no texto.
      const words = new Set(normalize(message).split(/[^a-z0-9]+/));
      const near = (gp) => Math.abs(Date.parse(gp.sent_on) - Date.parse(day)) <= 3 * 86400000;
      const named = (gp) => words.has(normalize(gp.employee_name).split(" ")[0]) || (gp.is_team && words.has("equipe"));
      candidates = free.filter((gp) => near(gp) && named(gp));
    }
    if (candidates.length === 1) {
      goodPracticeId = candidates[0].id;
      usedGoodPractice.add(goodPracticeId);
      linked++;
    }
  }
  rows.push({
    feedz_id: item.id,
    kind: isGoodPractice ? "boa_pratica" : "sem_tipo",
    from_employee_id: from.id,
    to_employee_id: to.id,
    visibility: "privado",
    civil_values: valuesOf(ratings),
    value_ratings: ratings,
    template_name: item.template?.name ?? null,
    message: message.slice(0, 20000),
    in_person: Boolean(item.offline),
    read_at: fromFeedzStamp(item.dt_read),
    created_at: fromFeedzStamp(item.dt_feedback),
    good_practice_id: goodPracticeId,
  });
  (item.threads ?? []).forEach((thread, index) => {
    const author = thread.profile ? hrOf(thread.profile) : hrOf({ id: thread.id_profile, name: "" });
    const text = htmlToText(thread.message);
    if (!author || !text) return;
    replies.push({ feedz_id: Number(item.id) * 100 + index, feedback_feedz_id: item.id, author_employee_id: author.id, message: text.slice(0, 5000), created_at: fromFeedzStamp(thread.dt_created) });
  });
}

const by = (list, key) => list.reduce((acc, row) => ((acc[row[key]] = (acc[row[key]] ?? 0) + 1), acc), {});
console.log("\n=== Importação dos feedbacks do Feedz", WRITE ? "(GRAVANDO)" : "(simulação)", "===");
console.log(`Feedbacks no Feedz: ${data.feedbacks?.length ?? 0} · entram: ${rows.length}`);
console.log("  por tipo:", by(rows, "kind"));
console.log(`  presenciais: ${rows.filter((row) => row.in_person).length} · lidos: ${rows.filter((row) => row.read_at).length} · com notas CIVIL: ${rows.filter((row) => row.value_ratings).length}`);
console.log(`  Boas práticas ligadas a um registro: ${linked} de ${rows.filter((row) => row.kind === "boa_pratica").length}`);
console.log(`Respostas: ${replies.length}`);
if (unmatched.size) console.log("Pessoas sem cadastro:\n  - " + [...unmatched.values()].join("\n  - "));
if (skipped.length) console.log(`Não entram (${skipped.length}):\n  - ` + skipped.slice(0, 30).join("\n  - ") + (skipped.length > 30 ? `\n  … e mais ${skipped.length - 30}` : ""));

if (!WRITE) {
  console.log("\nSimulação: nada foi gravado. Rode com --gravar para importar.");
  process.exit(0);
}

const saved = [];
for (let index = 0; index < rows.length; index += 200) {
  saved.push(...(await must(db.from("hr_feedbacks").upsert(rows.slice(index, index + 200), { onConflict: "feedz_id" }).select("id, feedz_id"), "feedbacks")));
}
const idByFeedz = new Map(saved.map((row) => [Number(row.feedz_id), row.id]));
const replyRows = replies
  .map(({ feedback_feedz_id, ...row }) => ({ ...row, feedback_id: idByFeedz.get(Number(feedback_feedz_id)) }))
  .filter((row) => row.feedback_id);
for (let index = 0; index < replyRows.length; index += 200) {
  await must(db.from("hr_feedback_replies").upsert(replyRows.slice(index, index + 200), { onConflict: "feedz_id" }), "respostas");
}
console.log(`\nGravado: ${saved.length} feedbacks e ${replyRows.length} respostas.`);
