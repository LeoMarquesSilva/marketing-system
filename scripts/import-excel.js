/**
 * Script para importar dados do Excel "Solicitações Marketing" para o Supabase
 * Uso: node scripts/import-excel.js
 * Requer: .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Configure .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

function excelDateToISO(serial) {
  if (serial === null || serial === undefined || serial === "") return null;
  let date;
  if (typeof serial === "number") {
    // Excel serial number (dias desde 30/12/1899)
    date = new Date((serial - 25569) * 86400 * 1000);
  } else if (typeof serial === "string") {
    // String no formato DD/MM/YYYY, YYYY-MM-DD, etc.
    date = new Date(serial);
  } else {
    date = new Date(serial);
  }
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function inferStatus(requestedAt, deliveredAt) {
  if (deliveredAt) return "completed";
  const daysSince = (Date.now() - new Date(requestedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 7 ? "in_progress" : "pending";
}

async function main() {
  const dir = path.join(__dirname, "..");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".xlsx"));
  if (files.length === 0) {
    console.error("Nenhum arquivo .xlsx encontrado na raiz do projeto");
    process.exit(1);
  }
  const filePath = path.join(dir, files[0]);
  console.log("Lendo:", filePath);

  const wb = XLSX.readFile(filePath);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const headers = raw[0] || [];
  const data = raw.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  const areaMap = { Civel: "Cível" };
  const normalizeArea = (a) => areaMap[a] || a || "Outros";

  const typeMap = {
    "Post Redes Socias": "Post Redes Sociais",
    "Aplicação identidade": "Aplicação de Identidade",
    "EBOOK": "E-book",
    "Identidade Visual": "Identidade Visual",
    "Comunicado": "Comunicado",
    "PPT": "PPT",
    "Certificados": "Certificados",
  };
  const normalizeType = (t) => typeMap[t] || t || "Comunicado";

  const { data: users } = await supabase.from("users").select("id, name");
  const userList = users || [];

  function findUserId(solicitante) {
    if (!solicitante || !solicitante.trim()) return null;
    const s = (solicitante + "").trim().toLowerCase().replace(/\s+/g, " ");
    const words = s.split(" ").filter(Boolean);
    const exact = userList.find((u) => (u.name || "").trim().toLowerCase() === s);
    if (exact) return exact.id;
    const startsWith = userList.find((u) => {
      const un = (u.name || "").trim().toLowerCase();
      return un.startsWith(s) || un.startsWith(s + " ");
    });
    if (startsWith) return startsWith.id;
    const wordMatch = userList.find((u) => {
      const un = (u.name || "").trim().toLowerCase();
      return words.every((w) => un.includes(w));
    });
    return wordMatch ? wordMatch.id : null;
  }

  const rows = data
    .filter((r) => r.SOLICITANTE || r.SOLICITAÇÃO)
    .map((r) => {
      const requestedAt = excelDateToISO(r["DATA PEDIDO"]) || new Date().toISOString();
      const deliveredAt = r["DATA ENTREGUE"] ? excelDateToISO(r["DATA ENTREGUE"]) : null;
      const rawType = r.SOLICITAÇÃO || "Comunicado";
      const normalizedType = normalizeType(rawType);
      const solicitante = r.SOLICITANTE || null;
      return {
        title: normalizedType,
        description: r["DETALHE SOLICITAÇÃO"] || null,
        requesting_area: normalizeArea(r.ÁREA),
        status: inferStatus(requestedAt, deliveredAt),
        requested_at: requestedAt,
        delivered_at: deliveredAt,
        solicitante,
        solicitante_id: findUserId(solicitante),
        request_type: normalizedType,
      };
    });

  console.log(`Importando ${rows.length} registros...`);
  const { data: inserted, error } = await supabase.from("marketing_requests").insert(rows).select();

  if (error) {
    console.error("Erro:", error);
    process.exit(1);
  }
  console.log(`Importados ${inserted?.length || rows.length} registros com sucesso.`);
}

main();
