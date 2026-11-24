// Importa o histórico de Reuniões 1:1 do Feedz para o ORQESTRAI.
//
// Entrada: JSON montado na sessão logada do Feedz (veja docs/feedz/telas-logado.md):
//   {
//     meetings: [...]   → /gestao/1on1/lista (todas as datas; traz anotação do líder e ações por reunião)
//     pairs:    {"<idGestor>-<idLiderado>": /api/1on1/find-all-between-participants}  (horário de início e fim, link)
//     topics:   {"<idReunião>": /api/1on1/{id}/meeting-topics}                         (pauta)
//     notes:    {"<idReunião>": /api/1on1/{id}/private-notes?routeAdmin=1}             (anotações dos dois)
//     actions:  {"<idGestor>-<idLiderado>": /api/1on1/actions?id_pair=...&limit=500}   (ações com responsável)
//   }
//
// Uso:
//   node scripts/importar-1-1-feedz.mjs <arquivo.json>            → simulação (não grava)
//   node scripts/importar-1-1-feedz.mjs <arquivo.json> --gravar   → grava
//
// Regras:
//   - Pessoas: casa pelo e-mail (hr_employees.email ou users.email), depois pelo nome completo.
//   - Reuniões, pauta e ações: upsert por feedz_id (rodar de novo atualiza, não duplica).
//   - Anotações privadas: uma por autor e reunião (upsert por reunião + autor).
//   - Realizada = o Feedz tem data de finalização. Sem ela, entra como agendada (a tela mostra "não finalizada").
//   - Texto do editor do Feedz (HTML) vira texto simples com quebras de linha e marcadores.
//   - Nada é deduzido: sem horário de fim no Feedz, a reunião não entra (aparece no relatório).

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

/** Horário do Feedz é de Brasília (sem horário de verão desde 2019). */
const brasilia = (date, time) => (date && time ? `${date}T${time.length === 5 ? `${time}:00` : time}-03:00` : null);
const fromFeedzStamp = (value) => (value ? brasilia(String(value).slice(0, 10), String(value).slice(11, 19)) : null);

const ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•" };
/** HTML do editor do Feedz → texto simples (parágrafos, listas com •, sem tags). */
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
    // Comentários condicionais do Word que vinham escapados (&lt;!-- [if !vml]--&gt;).
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[(?:end)?if[^\]]*\]>/gi, "");
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n•\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
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
const employees = await must(db.from("hr_employees").select("id, full_name, email, user_id, is_active, is_automation"), "colaboradores");
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
  const emails = new Set([employee.email, employee.user_id ? userEmail.get(employee.user_id) : ""].map(canonEmail).filter(Boolean));
  for (const email of emails) {
    const current = byEmail.get(email);
    byEmail.set(email, current === undefined || current?.id === employee.id ? employee : null);
  }
  const name = normalize(employee.full_name);
  byName.set(name, byName.has(name) ? null : employee);
}
function match(email, name) {
  return byEmail.get(canonEmail(email)) || byName.get(normalize(name)) || null;
}

// --- pessoas do Feedz (gestor e liderado de cada reunião) ------------------
const feedzPeople = new Map();
for (const meeting of data.meetings ?? []) {
  for (const person of [meeting.manager, meeting.profile]) if (person?.id) feedzPeople.set(person.id, person);
}
const feedzToHr = new Map();
const unmatchedPeople = new Set();
for (const person of feedzPeople.values()) {
  const employee = match(person.email, person.name);
  if (employee) feedzToHr.set(person.id, employee);
  else unmatchedPeople.add(`${person.name} <${person.email ?? "sem e-mail"}>`);
}

// --- categorias -------------------------------------------------------------
const categories = await must(db.from("hr_one_on_one_categories").select("id, name, feedz_name"), "categorias");
const categoryByFeedz = new Map(categories.filter((row) => row.feedz_name).map((row) => [normalize(row.feedz_name), row.id]));
const unknownCategories = new Set();

// --- horários (início e fim) por reunião ------------------------------------
const slot = new Map();
for (const pair of Object.values(data.pairs ?? {})) {
  const payload = pair?.data ?? {};
  for (const block of [payload.nextAndPreviousMeeting, payload.scheduledMeeting]) {
    const list = Array.isArray(block?.data) ? block.data : Object.values(block?.data ?? {});
    for (const item of list) {
      if (!item?.id) continue;
      slot.set(Number(item.id), {
        starts_at: brasilia(item.dateMeet, item.hourStartMeet),
        ends_at: brasilia(item.dateMeet, item.hourFinishMeet),
        url: typeof item.urlMeet === "string" && /^https?:\/\//.test(item.urlMeet) ? item.urlMeet : null,
      });
    }
  }
}

// --- reuniões ---------------------------------------------------------------
const meetingRows = [];
const skipped = [];
for (const meeting of data.meetings ?? []) {
  const leader = feedzToHr.get(meeting.id_manager);
  const member = feedzToHr.get(meeting.id_profile);
  const label = `${meeting.manager?.name ?? "?"} e ${meeting.profile?.name ?? "?"} em ${String(meeting.scheduled_at).slice(0, 16)}`;
  if (!leader || !member) {
    skipped.push(`${label}: pessoa sem cadastro no ORQESTRAI`);
    continue;
  }
  if (leader.id === member.id) {
    skipped.push(`${label}: líder e liderado são a mesma pessoa`);
    continue;
  }
  const times = slot.get(Number(meeting.id));
  const starts = times?.starts_at ?? fromFeedzStamp(meeting.scheduled_at);
  const ends = times?.ends_at;
  if (!starts || !ends || new Date(ends) <= new Date(starts)) {
    skipped.push(`${label}: Feedz não informou o horário de término`);
    continue;
  }
  let categoryId = null;
  if (meeting.category?.name) {
    categoryId = categoryByFeedz.get(normalize(meeting.category.name)) ?? null;
    if (!categoryId) unknownCategories.add(meeting.category.name.trim());
  }
  meetingRows.push({
    feedz_id: meeting.id,
    leader_employee_id: leader.id,
    member_employee_id: member.id,
    category_id: categoryId,
    starts_at: starts,
    ends_at: ends,
    status: meeting.realized_at ? "realizada" : "agendada",
    finished_at: fromFeedzStamp(meeting.realized_at),
    teams_join_url: times?.url ?? null,
  });
}

// --- pauta --------------------------------------------------------------------
const topicRows = [];
let longTopics = 0;
for (const meetingRow of meetingRows) {
  const payload = data.topics?.[meetingRow.feedz_id];
  const list = Array.isArray(payload?.data) ? payload.data : [];
  list.forEach((topic, index) => {
    let title = htmlToText(topic.description);
    if (!title) return;
    // Tópico pode ser uma ata inteira (o banco aceita até 20 mil caracteres para o que vem do Feedz).
    if (title.length > 20000) {
      longTopics++;
      title = `${title.slice(0, 19997)}…`;
    }
    topicRows.push({
      feedz_id: topic.id,
      meeting_feedz_id: meetingRow.feedz_id,
      title,
      source: "feedz",
      author_employee_id: feedzToHr.get(topic.id_profile)?.id ?? null,
      discussed: false,
      sort_order: index,
      created_at: fromFeedzStamp(topic.updated_at) ?? meetingRow.starts_at,
    });
  });
}

// --- anotações privadas --------------------------------------------------------
const noteRows = [];
const longNotes = [];
const meetingByFeedz = new Map((data.meetings ?? []).map((meeting) => [meeting.id, meeting]));
for (const meetingRow of meetingRows) {
  const payload = data.notes?.[meetingRow.feedz_id]?.data;
  const source = meetingByFeedz.get(meetingRow.feedz_id);
  const entries = [...(payload?.logged_profile ?? []), ...(payload?.profile ?? [])];
  // Sem a rota de admin, a lista do Feedz ainda traz a anotação do líder.
  if (!entries.length && source?.private_notes_manager) {
    entries.push({ id_profile: source.id_manager, private_notes: source.private_notes_manager });
  }
  for (const entry of entries) {
    const author = feedzToHr.get(entry.id_profile);
    const body = htmlToText(entry.private_notes);
    if (!author || !body) continue;
    if (body.length > 30000) longNotes.push(`${source?.manager?.name} e ${source?.profile?.name} (${String(source?.scheduled_at).slice(0, 10)}): ${body.length} caracteres`);
    const stamp = entry.update_date && entry.update_hour ? brasilia(entry.update_date, entry.update_hour) : meetingRow.finished_at ?? meetingRow.starts_at;
    noteRows.push({
      meeting_feedz_id: meetingRow.feedz_id,
      author_employee_id: author.id,
      body: body.slice(0, 30000),
      created_at: stamp,
      updated_at: stamp,
    });
  }
}

// --- ações combinadas ---------------------------------------------------------
const doneFromList = new Map();
for (const meeting of data.meetings ?? []) {
  for (const action of meeting.one_on_one_actions ?? []) {
    if (action.realized_at) doneFromList.set(`${action.id_one}|${normalize(action.name)}`, fromFeedzStamp(action.realized_at));
  }
}
const actionRows = [];
const actionsWithoutDate = [];
const seenActions = new Set();
for (const [pairKey, payload] of Object.entries(data.actions ?? {})) {
  const [feedzLeader, feedzMember] = pairKey.split("-").map(Number);
  const leader = feedzToHr.get(feedzLeader);
  const member = feedzToHr.get(feedzMember);
  if (!leader || !member || leader.id === member.id) continue;
  const groups = payload?.data ?? {};
  for (const [state, group] of [["aberta", groups.andamento], ["feita", groups.concluido]]) {
    const list = Object.entries(group ?? {})
      .filter(([key]) => key !== "total")
      .map(([, value]) => value);
    for (const action of list) {
      if (!action?.id || seenActions.has(action.id)) continue;
      seenActions.add(action.id);
      const title = htmlToText(action.name).slice(0, 1000);
      if (!title) continue;
      let doneAt = null;
      if (state === "feita") {
        doneAt = doneFromList.get(`${action.id_one}|${normalize(action.name)}`) ?? null;
        if (!doneAt) {
          // Feedz marca como concluída mas não guarda quando: usa a finalização da reunião.
          const meeting = meetingByFeedz.get(action.id_one);
          doneAt = fromFeedzStamp(meeting?.realized_at) ?? fromFeedzStamp(action.creationDate);
          actionsWithoutDate.push(title.slice(0, 60));
        }
      }
      actionRows.push({
        feedz_id: action.id,
        leader_employee_id: leader.id,
        member_employee_id: member.id,
        meeting_feedz_id: action.id_one ?? null,
        title,
        owner_employee_id: feedzToHr.get(action.id_profile)?.id ?? null,
        done_at: doneAt,
        created_at: fromFeedzStamp(action.creationDate) ?? new Date().toISOString(),
      });
    }
  }
}

// --- relatório ------------------------------------------------------------------
const pairsCount = new Set(meetingRows.map((row) => `${row.leader_employee_id}|${row.member_employee_id}`)).size;
console.log("\n=== Importação das 1:1 do Feedz", WRITE ? "(GRAVANDO)" : "(simulação)", "===");
console.log(`Pessoas do Feedz: ${feedzPeople.size} · ligadas ao cadastro: ${feedzToHr.size}`);
if (unmatchedPeople.size) console.log("Sem correspondência no cadastro:\n  - " + [...unmatchedPeople].join("\n  - "));
console.log(`Reuniões no Feedz: ${data.meetings?.length ?? 0} · entram: ${meetingRows.length} (${pairsCount} duplas)`);
console.log(`  realizadas: ${meetingRows.filter((row) => row.status === "realizada").length} · agendadas/não finalizadas: ${meetingRows.filter((row) => row.status === "agendada").length}`);
console.log(`  sem categoria: ${meetingRows.filter((row) => !row.category_id).length} · com link de reunião: ${meetingRows.filter((row) => row.teams_join_url).length}`);
if (unknownCategories.size) console.log("Categorias do Feedz sem par no ORQESTRAI: " + [...unknownCategories].join(" | "));
if (skipped.length) console.log(`Reuniões que não entram (${skipped.length}):\n  - ` + skipped.join("\n  - "));
console.log(`Pauta: ${topicRows.length} tópicos${longTopics ? ` (${longTopics} cortados em 20 mil caracteres)` : ""}`);
console.log(`Anotações privadas: ${noteRows.length} (líder ${noteRows.filter((row) => meetingRows.find((m) => m.feedz_id === row.meeting_feedz_id)?.leader_employee_id === row.author_employee_id).length})`);
if (longNotes.length) console.log("Anotações acima de 30.000 caracteres (cortadas):\n  - " + longNotes.join("\n  - "));
console.log(`Ações combinadas: ${actionRows.length} · em aberto: ${actionRows.filter((row) => !row.done_at).length} · feitas: ${actionRows.filter((row) => row.done_at).length}`);
if (actionsWithoutDate.length) console.log(`  ${actionsWithoutDate.length} ações feitas sem data no Feedz (usada a finalização da reunião)`);
const totalErrors = Object.values(data.topics ?? {}).filter((value) => !value || value._status).length + Object.values(data.notes ?? {}).filter((value) => !value || value._status).length;
if (totalErrors) console.log(`Atenção: ${totalErrors} respostas do Feedz vieram vazias ou com erro.`);

if (!WRITE) {
  console.log("\nSimulação: nada foi gravado. Rode com --gravar para importar.");
  process.exit(0);
}

// --- gravação --------------------------------------------------------------------
async function upsertInChunks(table, rows, conflict, select) {
  const saved = [];
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200);
    const query = db.from(table).upsert(chunk, { onConflict: conflict });
    const result = await must(select ? query.select(select) : query, table);
    if (result) saved.push(...result);
  }
  return saved;
}

const savedMeetings = await upsertInChunks("hr_one_on_one_meetings", meetingRows, "feedz_id", "id, feedz_id");
const meetingId = new Map(savedMeetings.map((row) => [Number(row.feedz_id), row.id]));

await upsertInChunks(
  "hr_one_on_one_topics",
  topicRows.map(({ meeting_feedz_id, ...row }) => ({ ...row, meeting_id: meetingId.get(meeting_feedz_id) })).filter((row) => row.meeting_id),
  "feedz_id"
);
await upsertInChunks(
  "hr_one_on_one_notes",
  noteRows.map(({ meeting_feedz_id, ...row }) => ({ ...row, meeting_id: meetingId.get(meeting_feedz_id) })).filter((row) => row.meeting_id),
  "meeting_id,author_employee_id"
);
await upsertInChunks(
  "hr_one_on_one_actions",
  actionRows.map(({ meeting_feedz_id, ...row }) => ({ ...row, meeting_id: meeting_feedz_id ? meetingId.get(meeting_feedz_id) ?? null : null })),
  "feedz_id"
);
console.log("\nGravado: reuniões, pauta, anotações e ações.");
