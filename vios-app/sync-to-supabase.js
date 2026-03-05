/**
 * Sincroniza CSV de tarefas VIOS para o Supabase.
 * Filtra apenas: MATERIAL MARKETING - REELS/POST/ARTIGO
 *
 * Uso: node sync-to-supabase.js <caminho-do-csv>
 * Ou importado: const { syncViosToSupabase } = require('./sync-to-supabase');
 *
 * Requer .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

function readCSV(filePath) {
  const { parse } = require("csv-parse/sync");
  const content = fs.readFileSync(filePath, "utf8");
  const records = parse(content, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });
  return { rows: records };
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

function parseDateTimeDDMMYYYY(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function mapViosStatus(viosStatus) {
  const s = (viosStatus || "").trim().toLowerCase();
  if (s === "fechada" || s === "concluída" || s === "concluido") return "concluido";
  if (s === "em andamento" || s === "em_andamento") return "em_andamento";
  return "pendente";
}

function findUserId(userList, name) {
  if (!name || !String(name).trim()) return null;
  const s = String(name).trim().toLowerCase().replace(/\s+/g, " ");
  const words = s.split(" ").filter(Boolean);
  const exact = userList.find((u) => (u.name || "").trim().toLowerCase() === s);
  if (exact) return exact.id;
  const startsWith = userList.find((u) => {
    const un = (u.name || "").trim().toLowerCase();
    return un.startsWith(s) || s.startsWith(un);
  });
  if (startsWith) return startsWith.id;
  const wordMatch = userList.find((u) => {
    const un = (u.name || "").trim().toLowerCase();
    return words.every((w) => un.includes(w));
  });
  return wordMatch ? wordMatch.id : null;
}

function rowToViosTask(record, userList) {
  const viosId = getRecordVal(record, COL_NAMES.CI);
  if (!viosId) return null;

  const tarefaPai = getRecordVal(record, COL_NAMES.TAREFA_PAI);
  if (tarefaPai !== VIOS_TASK_LABEL) return null;

  const responsaveisRaw = getRecordVal(record, COL_NAMES.RESPONSAVEIS) || getRecordVal(record, COL_NAMES.RESPONSAVEL_PROCESSO);
  const responsaveisBruto = responsaveisRaw.replace(/\s*\|\s*/g, " | ").trim();
  const responsaveis = filterLeonardoFromResponsaveis(responsaveisBruto);
  const firstResponsavel = (responsaveis ?? "").split(/\s*\|\s*/)[0]?.trim() || "";

  const statusVios = getRecordVal(record, COL_NAMES.STATUS);
  const status = mapViosStatus(statusVios);

  const dataLimite = parseDateDDMMYYYY(getRecordVal(record, COL_NAMES.DATA_LIMITE) || getRecordVal(record, COL_NAMES.DATA_CONCLUSAO_PARA));
  const dataConclusaoRaw = getRecordVal(record, COL_NAMES.DATA_CONCLUSAO);
  const dataConclusao = dataConclusaoRaw ? parseDateTimeDDMMYYYY(dataConclusaoRaw) : null;
  const horaConclusao = getRecordVal(record, COL_NAMES.HORA_CONCLUSAO) || null;

  const assigneeId = findUserId(userList, firstResponsavel);

  return {
    vios_id: viosId,
    ci_processo: getRecordVal(record, COL_NAMES.CI_PROCESSO) || null,
    area_processo: getRecordVal(record, COL_NAMES.AREA_PROCESSO) || null,
    tarefa: tarefaPai,
    etiquetas_tarefa: getRecordVal(record, COL_NAMES.ETIQUETAS_TAREFA) || null,
    descricao: getRecordVal(record, COL_NAMES.DESCRICAO) || null,
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
}

/**
 * Sincroniza o CSV para o Supabase.
 * @param {string} csvPath - Caminho absoluto ou relativo do arquivo CSV
 * @returns {Promise<{ inserted: number; updated: number; total: number }>}
 */
async function syncViosToSupabase(csvPath) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(`Configure .env com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY`);
  }

  const resolved = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Arquivo não encontrado: ${resolved}`);
  }

  const supabase = createClient(url, key);

  const { rows } = readCSV(resolved);
  const { data: users } = await supabase.from("users").select("id, name");
  const userList = users || [];

  const tasks = [];
  for (const row of rows) {
    const task = rowToViosTask(row, userList);
    if (task) tasks.push(task);
  }

  if (tasks.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  const viosIds = tasks.map((t) => t.vios_id);
  const { data: existingRows } = await supabase
    .from("vios_tasks")
    .select("vios_id, marketing_request_id")
    .in("vios_id", viosIds);
  const existingMap = new Map((existingRows || []).map((r) => [r.vios_id, r]));

  const toInsert = tasks.filter((t) => !existingMap.has(t.vios_id));
  const toUpdate = tasks.filter((t) => existingMap.has(t.vios_id));

  if (toInsert.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH);
      const { error: inErr } = await supabase.from("vios_tasks").insert(chunk);
      if (inErr) throw new Error(`Erro ao inserir lote: ${inErr.message}`);
    }
  }

  for (const task of toUpdate) {
    const existing = existingMap.get(task.vios_id);
    const { error: upErr } = await supabase
      .from("vios_tasks")
      .update({
        ci_processo: task.ci_processo,
        area_processo: task.area_processo,
        tarefa: task.tarefa,
        etiquetas_tarefa: task.etiquetas_tarefa,
        descricao: task.descricao,
        historico: task.historico,
        data_limite: task.data_limite,
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
    if (upErr) throw new Error(`Erro ao atualizar vios_id ${task.vios_id}: ${upErr.message}`);
  }

  return { inserted: toInsert.length, updated: toUpdate.length, total: tasks.length };
}

// CLI
if (require.main === module) {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Uso: node sync-to-supabase.js <caminho-do-csv>");
    process.exit(1);
  }
  syncViosToSupabase(csvPath)
    .then((r) => {
      console.log(`✅ Sync concluído: ${r.inserted} inseridos, ${r.updated} atualizados (${r.total} tarefas MATERIAL MARKETING)`);
    })
    .catch((err) => {
      console.error("❌ Erro no sync:", err.message);
      process.exit(1);
    });
}

module.exports = { syncViosToSupabase };
