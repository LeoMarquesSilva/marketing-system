/**
 * Importa contatos exportados do RD Station Marketing para email_contacts.
 *
 * Uso: node scripts/import-rd-contacts.js [caminho-do-csv]
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const CSV_DEFAULT =
  "rd-bismarchi-pires-sociedade-de-advogados-leads-todos-os-contatos-da-base-de-leads.csv";
const BATCH_SIZE = 100;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey);

function findColumnKey(row, includes) {
  const needles = includes.map((s) => s.toLowerCase());
  return Object.keys(row).find((k) => {
    const norm = k.toLowerCase();
    return needles.every((n) => norm.includes(n));
  });
}

function pick(row, keys) {
  for (const key of keys) {
    const match = Object.entries(row).find(([k]) => {
      const norm = k.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
      const target = key.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
      return norm === target || norm.includes(target);
    });
    if (match && match[1] != null && String(match[1]).trim()) return String(match[1]).trim();
  }
  return null;
}

function parseTags(raw) {
  if (!raw) return [];
  return [...new Set(String(raw).split(/[,;|]/).map((t) => t.trim()).filter(Boolean))];
}

function parseStatus(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "false" || v === "0" || v === "nao" || v === "não") return "unsubscribed";
  return "subscribed";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  const csvPath = path.resolve(process.argv[2] || CSV_DEFAULT);
  if (!fs.existsSync(csvPath)) {
    console.error("Arquivo não encontrado:", csvPath);
    process.exit(1);
  }

  const workbook = XLSX.read(fs.readFileSync(csvPath));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const sample = rawRows[0] ?? {};
  const statusKey = findColumnKey(sample, ["status", "email"]) ?? findColumnKey(sample, ["comunic", "email"]);

  const seen = new Set();
  const contacts = [];

  for (const row of rawRows) {
    const email = pick(row, ["email"])?.toLowerCase();
    if (!email || !isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);

    const statusRaw = statusKey ? row[statusKey] : null;
    const status = parseStatus(statusRaw);

    contacts.push({
      email,
      name: pick(row, ["nome", "nome completo"]),
      phone: pick(row, ["celular", "celular / whatsapp", "telefone"]),
      company: pick(row, ["empresa", "grupo empresa", "razao social"]),
      tags: parseTags(pick(row, ["tags"])),
      status,
      source: "rd-station",
      custom_fields: {
        cargo: pick(row, ["cargo"]),
        cidade: pick(row, ["cidade"]),
        estado: pick(row, ["estado"]),
        pais: pick(row, ["pais"]),
        estagio_funil: pick(row, ["estagio no funil", "estagio do funil"]),
        linkedin: pick(row, ["linkedin"]),
        website: pick(row, ["website"]),
        base_legal: pick(row, ["base legal para comunicacao"]),
        rd_public_url: pick(row, ["url publica"]),
      },
      unsubscribed_at: status === "unsubscribed" ? new Date().toISOString() : null,
    });
  }

  console.log(`Linhas na planilha: ${rawRows.length}`);
  console.log(`Contatos válidos para importar: ${contacts.length}`);

  let imported = 0;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const { error } = await admin.from("email_contacts").upsert(batch, { onConflict: "email" });
    if (error) {
      console.error("Erro no lote", i / BATCH_SIZE + 1, error.message);
      process.exit(1);
    }
    imported += batch.length;
    console.log(`Importados ${imported}/${contacts.length}...`);
  }

  const subscribed = contacts.filter((c) => c.status === "subscribed").length;
  const unsubscribed = contacts.filter((c) => c.status === "unsubscribed").length;
  console.log("\nConcluído!");
  console.log(`  Total importado: ${imported}`);
  console.log(`  Inscritos: ${subscribed}`);
  console.log(`  Descadastrados: ${unsubscribed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
