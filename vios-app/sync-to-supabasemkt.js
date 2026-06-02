/**
 * Sincroniza CSV de tarefas VIOS para o Supabase.
 * Filtra apenas: MATERIAL MARKETING - REELS/POST/ARTIGO
 *
 * Uso: node sync-to-supabasemkt.js <caminho-do-csv>
 *
 * Requer .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const VIOS_TASK_LABEL = "MATERIAL MARKETING - REELS/POST/ARTIGO";
const NOME_ANALISTA_EXCLUIR = "Leonardo Marques Silva";

function normalizeNameForCompare(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

const COL_NAMES = {
  CI: "CI",
  CI_PROCESSO: "CI do Processo",
  DATA_CONCLUSAO_PARA: "Data para conclusão",
  DATA_LIMITE: "Data limite",
  AREA_PROCESSO: "Área do Processo",
  TAREFA: "Tarefa",
  TAREFA_PAI: "Tarefa Pai",
  ETIQUETAS_TAREFA: "Etiquetas da Tarefa",
  DESCRICAO: "Descrição",
  COMENTARIOS: "Comentários",
  HISTORICO: "Histórico",
  RESPONSAVEL_PROCESSO: "Responsável pelo processo",
  RESPONSAVEIS: "Responsáveis",
  STATUS: "Status",
  USUARIO_CONCLUIU: "Usuário que concluiu a tarefa",
  DATA_CONCLUSAO: "Data da Conclusão",
  HORA_CONCLUSAO: "Hora da Conclusão",
};

function filterLeonardoFromResponsaveis(str) {
  if (!str?.trim()) return str;
  const normalized = normalizeNameForCompare(NOME_ANALISTA_EXCLUIR);
  const parts = str.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((p) => normalizeNameForCompare(p) !== normalized);
  return filtered.length > 0 ? filtered.join(" | ") : null;
}

function findColKey(record, ...candidates) {
  const keys = Object.keys(record || {});
  for (const c of candidates) {
    const k = keys.find((key) => key.trim().toLowerCase() === c.trim().toLowerCase());
    if (k) return k;
  }
  return null;
}

function getRecordVal(record, ...candidates) {
  const key = findColKey(record, ...candidates);
  if (!key) return "";
  const v = record[key];
  return v != null ? String(v).trim() : "";
}

function stripExcelFormula(val) {
  let s = String(val ?? "").trim();
  if (s.startsWith("=")) {
    s = s.substring(1).replace(/^["']|["']$/g, "");
  }
  return s.replace(/^"|"$/g, "").trim();
}

function readFileWithEncoding(filePath) {
  const buf = fs.readFileSync(filePath);
  const utf8 = buf.toString("utf8");
  if (utf8.includes("\uFFFD")) {
    console.log("⚠️ Encoding incorreto detectado, usando latin1...");
    return buf.toString("latin1");
  }
  return utf8;
}

/** Remove fórmulas Excel do export VIOS (ex.: ="123456") antes do csv-parse. */
function normalizeViosCsvContent(content) {
  return content
    .replace(/"=""([^"]*)"""/g, '"$1"')
    .replace(/="([^"\r\n;]*)"/g, "$1");
}

function readCSV(filePath) {
  const raw = readFileWithEncoding(filePath);
  const content = normalizeViosCsvContent(raw);
  const records = parse(content, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    bom: true,
    trim: true,
  }).map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim()] = stripExcelFormula(value);
    }
    return normalized;
  });

  const headers = records.length ? Object.keys(records[0]) : [];
  console.log("\n🔤 Primeiras 10 colunas do CSV:");
  headers.slice(0, 10).forEach((h, i) => {
    console.log(`   ${i + 1}. "${h}"`);
  });

  return { rows: records, headers };
}

function parseDateDDMMYYYY(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const [, d, month, y] = m;
    const date = new Date(parseInt(y, 10), parseInt(month, 10) - 1, parseInt(d, 10));
    return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** dd/mm ou dd/mm/yyyy — infere ano a partir do prazo atual quando omitido. */
function parsePartialDateFromHistorico(val, referenceDateIso) {
  const s = String(val ?? "").trim();
  if (!s) return null;
  const full = parseDateDDMMYYYY(s);
  if (full) return full;
  const short = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (!short) return null;
  const ref = referenceDateIso ? new Date(referenceDateIso + "T12:00:00") : new Date();
  const y = ref.getFullYear();
  return parseDateDDMMYYYY(`${short[1]}/${short[2]}/${y}`);
}

function detectProrrogacaoFromHistorico(historico, dataLimiteAtual) {
  if (!historico?.trim()) return { prorrogada: false, data_limite_anterior: null };
  const prorrogada = /PRORROG/i.test(historico);
  const match = historico.match(/alterada de\s+(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/i);
  const data_limite_anterior = match
    ? parsePartialDateFromHistorico(match[1], dataLimiteAtual)
    : null;
  return { prorrogada: prorrogada || !!data_limite_anterior, data_limite_anterior };
}

function resolveProrrogacaoFields(task, existing) {
  const fromHist = detectProrrogacaoFromHistorico(task.historico, task.data_limite);
  let prorrogada = fromHist.prorrogada || existing?.prorrogada === true;
  let data_limite_anterior =
    fromHist.data_limite_anterior || existing?.data_limite_anterior || null;

  if (
    existing?.data_limite &&
    task.data_limite &&
    existing.data_limite !== task.data_limite
  ) {
    prorrogada = true;
    if (!data_limite_anterior) {
      data_limite_anterior = existing.data_limite;
    }
  }

  return { prorrogada: !!prorrogada, data_limite_anterior };
}

function parseDateTimeDDMMYYYY(dateVal, timeVal) {
  const datePart = parseDateDDMMYYYY(dateVal);
  if (!datePart) return null;

  const time = String(timeVal ?? "").trim();
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) {
    return new Date(`${datePart}T12:00:00`).toISOString();
  }

  const [, hh, mm, ss = "00"] = timeMatch;
  const [y, month, d] = datePart.split("-");
  const dt = new Date(
    parseInt(y, 10),
    parseInt(month, 10) - 1,
    parseInt(d, 10),
    parseInt(hh, 10),
    parseInt(mm, 10),
    parseInt(ss, 10)
  );
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function mapViosStatus(viosStatus) {
  const s = (viosStatus || "").trim().toLowerCase();
  if (s === "concluída" || s === "concluida" || s === "fechada" || s === "finalizada" || s === "concluido") {
    return "concluido";
  }
  if (s === "aberta" || s === "em andamento" || s === "em_andamento" || s === "em execução") {
    return "em_andamento";
  }
  if (s === "cancelada") {
    return "pendente";
  }
  return "pendente";
}

function findUserId(userList, name) {
  if (!name || !String(name).trim()) return null;
  const activeUsers = userList.filter((u) => u.is_active !== false);
  const s = String(name).trim().toLowerCase().replace(/\s+/g, " ");
  const words = s.split(" ").filter(Boolean);
  const exact = activeUsers.find((u) => (u.name || "").trim().toLowerCase() === s);
  if (exact) return exact.id;
  const startsWith = activeUsers.find((u) => {
    const un = (u.name || "").trim().toLowerCase();
    return un.startsWith(s) || s.startsWith(un);
  });
  if (startsWith) return startsWith.id;
  const wordMatch = activeUsers.find((u) => {
    const un = (u.name || "").trim().toLowerCase();
    return words.every((w) => un.includes(w));
  });
  return wordMatch ? wordMatch.id : null;
}

function nameMatchesInactiveUser(name, inactiveUsers) {
  const s = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return false;
  const words = s.split(" ").filter(Boolean);
  for (const u of inactiveUsers) {
    const un = (u.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (un === s) return true;
    if (un.startsWith(s) || s.startsWith(un)) return true;
    if (words.length > 0 && words.every((w) => un.includes(w))) return true;
  }
  return false;
}

function isInactiveCollaboratorTask(task, inactiveUsers) {
  if (!inactiveUsers.length) return false;
  if (task.assignee_id && inactiveUsers.some((u) => u.id === task.assignee_id)) return true;
  const parts = (task.responsaveis ?? "")
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.some((part) => nameMatchesInactiveUser(part, inactiveUsers));
}

function rowToViosTask(record, userList, inactiveUsers) {
  const viosId = getRecordVal(record, COL_NAMES.CI);
  if (!viosId) return null;

  const tarefaPai = getRecordVal(record, COL_NAMES.TAREFA_PAI);
  if (tarefaPai !== VIOS_TASK_LABEL) return null;

  const responsaveisRaw =
    getRecordVal(record, COL_NAMES.RESPONSAVEIS) ||
    getRecordVal(record, COL_NAMES.RESPONSAVEL_PROCESSO);
  const responsaveisBruto = responsaveisRaw.replace(/\s*\|\s*/g, " | ").trim();
  const responsaveis = filterLeonardoFromResponsaveis(responsaveisBruto);
  const firstResponsavel = (responsaveis ?? "").split(/\s*\|\s*/)[0]?.trim() || "";

  const statusVios = getRecordVal(record, COL_NAMES.STATUS);
  const status = mapViosStatus(statusVios);

  const dataLimite = parseDateDDMMYYYY(
    getRecordVal(record, COL_NAMES.DATA_LIMITE) ||
      getRecordVal(record, COL_NAMES.DATA_CONCLUSAO_PARA)
  );
  const dataConclusaoRaw = getRecordVal(record, COL_NAMES.DATA_CONCLUSAO);
  const horaConclusao = getRecordVal(record, COL_NAMES.HORA_CONCLUSAO) || null;
  const dataConclusao = dataConclusaoRaw
    ? parseDateTimeDDMMYYYY(dataConclusaoRaw, horaConclusao)
    : null;

  const assigneeId = findUserId(userList, firstResponsavel);

  const task = {
    vios_id: viosId,
    ci_processo: getRecordVal(record, COL_NAMES.CI_PROCESSO) || null,
    area_processo: getRecordVal(record, COL_NAMES.AREA_PROCESSO) || null,
    tarefa: tarefaPai,
    etiquetas_tarefa: getRecordVal(record, COL_NAMES.ETIQUETAS_TAREFA) || null,
    descricao: getRecordVal(record, COL_NAMES.DESCRICAO) || null,
    comentarios: getRecordVal(record, COL_NAMES.COMENTARIOS) || null,
    historico: getRecordVal(record, COL_NAMES.HISTORICO) || null,
    data_limite: dataLimite,
    data_conclusao: dataConclusao,
    hora_conclusao: horaConclusao || null,
    responsaveis: responsaveis || null,
    assignee_id: assigneeId,
    status,
    usuario_concluiu: getRecordVal(record, COL_NAMES.USUARIO_CONCLUIU) || null,
    marketing_request_id: null,
    imported_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isInactiveCollaboratorTask(task, inactiveUsers)) return null;
  return task;
}

async function fetchExistingTasks(supabase, viosIds) {
  const existingMap = new Map();
  const BATCH = 200;

  for (let i = 0; i < viosIds.length; i += BATCH) {
    const chunk = viosIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("vios_tasks")
      .select("vios_id, marketing_request_id, status, data_limite, responsaveis, prorrogada, data_limite_anterior")
      .in("vios_id", chunk);

    if (error) {
      throw new Error(`Erro ao buscar tarefas existentes: ${error.message}`);
    }

    for (const row of data || []) {
      existingMap.set(row.vios_id, row);
    }
  }

  return existingMap;
}

/**
 * Sincroniza o CSV para o Supabase.
 * @param {string} csvPath - Caminho absoluto ou relativo do arquivo CSV
 * @returns {Promise<{ inserted: number; updated: number; total: number }>}
 */
export async function syncViosToSupabase(csvPath) {
  console.log("\n🔍 ==================== DIAGNÓSTICO SYNC ====================");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Configure .env com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const resolved = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Arquivo não encontrado: ${resolved}`);
  }

  console.log(`📂 Arquivo CSV: ${resolved}`);

  const supabase = createClient(url, key);
  const { rows, headers } = readCSV(resolved);

  const requiredCols = [COL_NAMES.CI, COL_NAMES.TAREFA_PAI, COL_NAMES.RESPONSAVEIS];
  const missingCols = requiredCols.filter((col) => !findColKey(rows[0] || {}, col));
  if (missingCols.length > 0) {
    console.warn(`⚠️ Colunas não encontradas no CSV (encoding/cabeçalho?): ${missingCols.join(", ")}`);
  }

  console.log(`\n📊 Total de linhas no CSV: ${rows.length}`);

  const { data: users, error: usersError } = await supabase.from("users").select("id, name, is_active");
  if (usersError) {
    console.error("❌ Erro ao buscar usuários:", usersError);
  }
  const userList = users || [];
  const inactiveUsers = userList.filter((u) => u.is_active === false);
  console.log(`👥 Total de usuários no Supabase: ${userList.length}`);
  console.log(`   🚫 Colaboradores inativos (ignorados): ${inactiveUsers.length}`);

  const tasks = [];
  let skippedNoCI = 0;
  let skippedWrongLabel = 0;
  let skippedInactive = 0;
  let missingAssignee = 0;

  for (const row of rows) {
    const viosId = getRecordVal(row, COL_NAMES.CI);
    if (!viosId) {
      skippedNoCI++;
      continue;
    }

    const tarefaPai = getRecordVal(row, COL_NAMES.TAREFA_PAI);
    if (tarefaPai !== VIOS_TASK_LABEL) {
      skippedWrongLabel++;
      continue;
    }

    const task = rowToViosTask(row, userList, inactiveUsers);
    if (!task) {
      skippedInactive++;
      continue;
    }

    if (!task.assignee_id && task.responsaveis) missingAssignee++;
    tasks.push(task);

    if (tasks.length <= 3) {
      console.log(`\n   ✅ Tarefa ${tasks.length} processada:`);
      console.log(`      - CI: ${task.vios_id}`);
      console.log(`      - Status: ${task.status}`);
      console.log(`      - Data Limite: ${task.data_limite}`);
      console.log(`      - Responsáveis: ${task.responsaveis}`);
      console.log(`      - Assignee ID: ${task.assignee_id}`);
    }
  }

  console.log("\n📈 Resultado do processamento:");
  console.log(`   ⏭️  Ignoradas por falta de CI: ${skippedNoCI}`);
  console.log(`   ⏭️  Ignoradas por Tarefa Pai diferente: ${skippedWrongLabel}`);
  console.log(`   ⏭️  Ignoradas por colaborador inativo: ${skippedInactive}`);
  console.log(`   ⚠️  Com responsável sem match em users: ${missingAssignee}`);
  console.log(`   ✅ Tarefas válidas para sync: ${tasks.length}`);

  if (tasks.length === 0) {
    console.log("\n⚠️ Nenhuma tarefa válida encontrada. Sync cancelado.");
    return { inserted: 0, updated: 0, total: 0 };
  }

  const viosIds = tasks.map((t) => t.vios_id);
  const existingMap = await fetchExistingTasks(supabase, viosIds);
  console.log(`\n📊 Tarefas já existentes no banco: ${existingMap.size}`);

  const toInsert = tasks.filter((t) => !existingMap.has(t.vios_id));
  const toUpdate = tasks.filter((t) => existingMap.has(t.vios_id));

  console.log(`\n📝 Plano de ação:`);
  console.log(`   ➕ Inserir: ${toInsert.length} novas tarefas`);
  console.log(`   🔄 Atualizar: ${toUpdate.length} tarefas existentes`);

  let prorrogadasDetectadas = 0;

  if (toInsert.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH).map((task) => {
        const pr = resolveProrrogacaoFields(task, null);
        if (pr.prorrogada) prorrogadasDetectadas++;
        return { ...task, ...pr };
      });
      const { error: inErr } = await supabase.from("vios_tasks").insert(chunk);
      if (inErr) {
        throw new Error(`Erro ao inserir lote: ${inErr.message}`);
      }
      console.log(`   ✅ Lote ${Math.floor(i / BATCH) + 1}: ${chunk.length} tarefas inseridas`);
    }
  }

  for (const task of toUpdate) {
    const existing = existingMap.get(task.vios_id);
    const pr = resolveProrrogacaoFields(task, existing);
    if (pr.prorrogada && !existing?.prorrogada) prorrogadasDetectadas++;

    const { error: upErr } = await supabase
      .from("vios_tasks")
      .update({
        ci_processo: task.ci_processo,
        area_processo: task.area_processo,
        tarefa: task.tarefa,
        etiquetas_tarefa: task.etiquetas_tarefa,
        descricao: task.descricao,
        comentarios: task.comentarios,
        historico: task.historico,
        data_limite: task.data_limite,
        data_limite_anterior: pr.data_limite_anterior,
        prorrogada: pr.prorrogada,
        data_conclusao: task.data_conclusao,
        hora_conclusao: task.hora_conclusao,
        responsaveis: task.responsaveis,
        assignee_id: task.assignee_id,
        status: task.status,
        usuario_concluiu: task.usuario_concluiu,
        imported_at: task.imported_at,
        updated_at: task.updated_at,
        marketing_request_id: existing?.marketing_request_id ?? null,
      })
      .eq("vios_id", task.vios_id);

    if (upErr) {
      throw new Error(`Erro ao atualizar vios_id ${task.vios_id}: ${upErr.message}`);
    }
  }

  console.log(`\n📅 Tarefas com prorrogação (total detectado neste sync): ${prorrogadasDetectadas}`);
  console.log("\n🎉 ==================== SYNC CONCLUÍDO ====================\n");

  return { inserted: toInsert.length, updated: toUpdate.length, total: tasks.length };
}

const isMain = process.argv[1]?.endsWith("sync-to-supabasemkt.js");
if (isMain) {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Uso: node sync-to-supabasemkt.js <caminho-do-csv>");
    process.exit(1);
  }
  syncViosToSupabase(csvPath)
    .then((r) => {
      console.log(
        `✅ Sync concluído: ${r.inserted} inseridos, ${r.updated} atualizados (${r.total} tarefas MATERIAL MARKETING)`
      );
    })
    .catch((err) => {
      console.error("❌ Erro no sync:", err.message);
      process.exit(1);
    });
}
