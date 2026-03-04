/**
 * Script para importar relatório VIOS (tarefas MATERIAL MARKETING - REELS/POST/ARTIGO) para o Supabase.
 * Uso: node scripts/import-vios.js [caminho-do-arquivo.csv|.xlsx]
 * Sem argumento: usa public/tarefas-vios-amostra2.csv ou primeiro .xlsx na raiz.
 * Requer: .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Configure .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const VIOS_TASK_LABEL = "MATERIAL MARKETING - REELS/POST/ARTIGO";

/** Nome do analista de marketing a ser sempre desconsiderado da coluna Responsáveis. */
const NOME_ANALISTA_EXCLUIR = "Leonardo Marques Silva";

function filterLeonardoFromResponsaveis(str) {
  if (!str?.trim()) return str;
  const parts = str.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((p) => p !== NOME_ANALISTA_EXCLUIR);
  return filtered.length > 0 ? filtered.join(" | ") : null;
}

// Nomes de colunas do relatório VIOS (no export, a tarefa pode vir em "Tarefa" ou "Tarefa Pai")
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
  const headers = records.length ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

function readExcel(filePath) {
  const XLSX = require("xlsx");
  const wb = XLSX.readFile(filePath);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const headers = raw[0] || [];
  const rows = raw.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] != null ? String(row[i]).trim() : "";
    });
    return obj;
  });
  return { headers, rows };
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

function normalizeArea(area) {
  const a = (area || "").trim();
  const map = {
    "Special Situations": "Distressed Deals - Special Situations",
    "Civel": "Cível",
    "Área Cível": "Cível",
    "Área Trabalhista": "Trabalhista",
    "Área Controladoria": "Operações Legais",
  };
  return map[a] || a || "Outros";
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
  const tarefaDetalhe = getRecordVal(record, COL_NAMES.TAREFA);
  if (tarefaPai !== VIOS_TASK_LABEL) return null;
  const tarefa = tarefaPai;

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
    tarefa,
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

// IMPORTANTE: Promoção para o Planner NUNCA deve ser feita aqui.
// Tarefas VIOS ficam APENAS em vios_tasks. Só vão ao Planner quando o usuário
// clicar em "Enviar ao Planner" na aba Tarefas VIOS (promoteViosTaskToPlanner).

async function main() {
  const inputPath = process.argv[2] || path.join(__dirname, "..", "public", "tarefas-vios-amostra2.csv");
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(resolved)) {
    const fallback = path.join(__dirname, "..", "tarefas-vios-amostra2.csv");
    if (fs.existsSync(fallback)) {
      console.log("Usando fallback:", fallback);
      return mainWithPath(fallback);
    }
    console.error("Arquivo não encontrado:", resolved);
    process.exit(1);
  }

  await mainWithPath(resolved);
}

async function mainWithPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let rows = [];

  if (ext === ".csv") {
    const { rows: rawRows } = readCSV(filePath);
    rows = rawRows;
  } else if (ext === ".xlsx" || ext === ".xls") {
    const { rows: rawRows } = readExcel(filePath);
    rows = rawRows;
  } else {
    console.error("Formato não suportado. Use .csv ou .xlsx");
    process.exit(1);
  }

  console.log("Linhas lidas:", rows.length);

  const { data: users } = await supabase.from("users").select("id, name");
  const userList = users || [];

  const tasks = [];
  for (const row of rows) {
    const task = rowToViosTask(row, userList);
    if (task) tasks.push(task);
  }

  console.log("Tarefas filtradas (MATERIAL MARKETING - REELS/POST/ARTIGO):", tasks.length);

  if (tasks.length === 0) {
    console.log("Nenhuma tarefa para importar.");
    return;
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
      if (inErr) console.error("Erro ao inserir lote:", inErr);
    }
  }

  for (const task of toUpdate) {
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
      })
      .eq("vios_id", task.vios_id);
    if (upErr) console.error("Erro ao atualizar vios_id", task.vios_id, upErr);
  }

  console.log("Inseridos:", toInsert.length, "Atualizados:", toUpdate.length);

  // Promoção para o Planner é feita apenas pelo gatilho manual na aba "Tarefas VIOS".
  console.log("Importação concluída.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
