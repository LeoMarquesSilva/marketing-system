/**
 * Importa uma ficha de férias da planilha do RH para o módulo de Férias.
 *
 * Uso:
 *   node scripts/import-ferias-felipe.mjs
 *   node scripts/import-ferias-felipe.mjs --sheet "SAMUEL WILLIAN"
 *   node scripts/import-ferias-felipe.mjs --file "caminho/planilha.xlsx" --skip-recess
 *
 * É idempotente: colaborador, períodos, gozos e recesso são casados por chave
 * natural, então rodar de novo não duplica registros.
 */

import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const DEFAULT_FILE = "public/ORQESTRAI/FICHA DE CARGOS E SALÁRIOS OPERAÇÕES LEGAIS_2024 (1).xlsx";
const DEFAULT_SHEET = "FELIPE CAMARGO";
const ENTITLED_DAYS = 30;

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, sheet: DEFAULT_SHEET, skipRecess: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--file") args.file = argv[++i];
    else if (argv[i] === "--sheet") args.sheet = argv[++i];
    else if (argv[i] === "--skip-recess") args.skipRecess = true;
  }
  return args;
}

/** Datas do xlsx vêm como Date no fuso local; converte para AAAA-MM-DD. */
function toISODate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso, amount) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function addYears(iso, amount) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year + amount, month - 1, day));
  return date.toISOString().slice(0, 10);
}

function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function titleCase(text) {
  const lower = ["de", "da", "do", "das", "dos", "e"];
  return String(text)
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && lower.includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function readSheetRows(file, sheetName) {
  const workbook = XLSX.readFile(file, { cellDates: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(
      `Aba "${sheetName}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(", ")}`
    );
  }
  return {
    rows: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }),
    recessRows: workbook.Sheets.Recesso
      ? XLSX.utils.sheet_to_json(workbook.Sheets.Recesso, { header: 1, defval: null })
      : [],
  };
}

/** Extrai cabeçalho, gozos e o resumo declarado na própria ficha. */
function parseEmployeeSheet(rows) {
  const fullName = rows[2]?.[0];
  const cpf = rows[2]?.[2];
  const department = rows[4]?.[0];
  const admissionDate = toISODate(rows[4]?.[5]);
  const position = rows[7]?.[6];

  if (!fullName) throw new Error("Não foi possível ler o nome do colaborador (célula A3).");
  if (!admissionDate) throw new Error("Não foi possível ler a data de admissão (célula F5).");

  const summaryRow = rows.find((row) => normalize(row?.[0]).startsWith("total de dias adquiridos"));
  const summary = summaryRow
    ? {
        entitled: Number(summaryRow[2]) || 0,
        taken: Number(summaryRow[4]) || 0,
        pending: Number(summaryRow[6]) || 0,
      }
    : null;

  const startIndex = rows.findIndex((row) => normalize(row?.[0]) === "dados de ferias");
  const leaves = [];
  for (let i = startIndex >= 0 ? startIndex : 0; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const start = toISODate(row[3]);
    const end = toISODate(row[4]);
    const days = Number(row[5]);
    if (!start || !end || !Number.isFinite(days) || days <= 0) continue;
    const notes = typeof row[6] === "string" ? row[6].trim() : null;
    leaves.push({
      start_date: start,
      end_date: end,
      days,
      kind: normalize(notes).startsWith("recesso") ? "recesso" : "ferias",
      notes: notes || null,
    });
  }

  return {
    fullName: titleCase(fullName),
    cpf: cpf ? String(cpf).trim() : null,
    department: department ? titleCase(department) : null,
    position: position ? titleCase(position) : null,
    admissionDate,
    leaves,
    summary,
  };
}

function parseRecessRows(rows) {
  const recess = [];
  for (const row of rows) {
    const start = toISODate(row?.[0]);
    const end = toISODate(row?.[1]);
    const days = Number(row?.[2]);
    if (!start || !end || !Number.isFinite(days) || days <= 0) continue;
    const notes = typeof row[3] === "string" ? row[3].trim() : null;
    recess.push({
      year: Number(start.slice(0, 4)),
      start_date: start,
      end_date: end,
      days,
      notes: notes || null,
    });
  }
  return recess;
}

function buildPeriods(admissionDate, referenceDate) {
  const periods = [];
  for (let index = 0; index < 60; index += 1) {
    const periodStart = addYears(admissionDate, index);
    const periodEnd = addDays(addYears(admissionDate, index + 1), -1);
    if (periodEnd > referenceDate) break;
    periods.push({
      period_start: periodStart,
      period_end: periodEnd,
      concessive_start: addDays(periodEnd, 1),
      concessive_end: addDays(addYears(addDays(periodEnd, 1), 1), -1),
      entitled_days: ENTITLED_DAYS,
    });
  }
  return periods;
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function findLinkedUser(db, fullName) {
  const { data, error } = await db.from("users").select("id, name, email").eq("is_active", true);
  if (error) throw new Error(`Falha ao carregar usuários: ${error.message}`);
  const target = normalize(fullName).split(/\s+/);
  const first = target[0];
  const last = target[target.length - 1];
  return (
    data.find((user) => {
      const parts = normalize(user.name).split(/\s+/);
      return parts[0] === first && (parts.includes(last) || target.includes(parts[parts.length - 1]));
    }) ?? null
  );
}

async function upsertEmployee(db, sheet, linkedUser) {
  const payload = {
    full_name: sheet.fullName,
    cpf: sheet.cpf,
    email: linkedUser?.email ?? null,
    department: sheet.department,
    position: sheet.position,
    admission_date: sheet.admissionDate,
    user_id: linkedUser?.id ?? null,
    is_active: true,
  };

  const existingQuery = sheet.cpf
    ? db.from("hr_employees").select("id").eq("cpf", sheet.cpf)
    : db.from("hr_employees").select("id").eq("full_name", sheet.fullName);
  const { data: existing, error: findError } = await existingQuery.maybeSingle();
  if (findError) throw new Error(`Falha ao procurar o colaborador: ${findError.message}`);

  if (existing) {
    const { data, error } = await db
      .from("hr_employees")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao atualizar o colaborador: ${error.message}`);
    return { id: data.id, created: false };
  }

  const { data, error } = await db.from("hr_employees").insert(payload).select("id").single();
  if (error) throw new Error(`Falha ao cadastrar o colaborador: ${error.message}`);
  return { id: data.id, created: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { rows, recessRows } = readSheetRows(args.file, args.sheet);
  const sheet = parseEmployeeSheet(rows);
  const referenceDate = new Date().toISOString().slice(0, 10);
  const periods = buildPeriods(sheet.admissionDate, referenceDate);

  console.log(`Ficha: ${sheet.fullName}`);
  console.log(`  Admissão: ${sheet.admissionDate}`);
  console.log(`  Períodos aquisitivos completos: ${periods.length}`);
  console.log(`  Lançamentos de férias: ${sheet.leaves.length}`);

  const db = createAdminClient();
  const linkedUser = await findLinkedUser(db, sheet.fullName);
  console.log(`  Usuário vinculado: ${linkedUser ? `${linkedUser.name} (${linkedUser.id})` : "nenhum"}`);

  const employee = await upsertEmployee(db, sheet, linkedUser);
  console.log(`  Colaborador ${employee.created ? "criado" : "atualizado"}: ${employee.id}`);

  const { error: periodError } = await db
    .from("vacation_periods")
    .upsert(
      periods.map((period) => ({ employee_id: employee.id, ...period })),
      { onConflict: "employee_id,period_start" }
    );
  if (periodError) throw new Error(`Falha ao gravar os períodos: ${periodError.message}`);

  // Gozos não têm chave natural na tabela: substitui o conjunto da ficha.
  const { error: deleteError } = await db
    .from("vacation_leaves")
    .delete()
    .eq("employee_id", employee.id);
  if (deleteError) throw new Error(`Falha ao limpar os lançamentos: ${deleteError.message}`);

  if (sheet.leaves.length > 0) {
    const { error: leaveError } = await db
      .from("vacation_leaves")
      .insert(sheet.leaves.map((leave) => ({ employee_id: employee.id, ...leave })));
    if (leaveError) throw new Error(`Falha ao gravar os lançamentos: ${leaveError.message}`);
  }

  if (!args.skipRecess) {
    const recess = parseRecessRows(recessRows);
    if (recess.length > 0) {
      const { error: recessError } = await db
        .from("company_recess")
        .upsert(recess, { onConflict: "year" });
      if (recessError) throw new Error(`Falha ao gravar o recesso: ${recessError.message}`);
      console.log(`  Recesso coletivo: ${recess.length} ano(s)`);
    }
  }

  const entitled = periods.length * ENTITLED_DAYS;
  const taken = sheet.leaves.reduce((sum, leave) => sum + leave.days, 0);
  const pending = entitled - taken;
  console.log(`\nResumo importado: ${entitled} adquiridos / ${taken} gozados / ${pending} pendentes`);

  if (sheet.summary) {
    const matches =
      sheet.summary.entitled === entitled &&
      sheet.summary.taken === taken &&
      sheet.summary.pending === pending;
    console.log(
      `Resumo da planilha: ${sheet.summary.entitled} / ${sheet.summary.taken} / ${sheet.summary.pending}`
    );
    if (!matches) {
      throw new Error("O resumo importado não bate com o resumo declarado na planilha.");
    }
    console.log("Conferência OK: os números batem com a planilha.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
