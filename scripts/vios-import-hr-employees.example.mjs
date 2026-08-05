/**
 * Exemplo: após baixar/parsear o Excel do VIOS, envia ao Supabase.
 *
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   node scripts/vios-import-hr-employees.example.mjs ./rel-funcionarios.csv
 *
 * O parse do CSV/XLSX fica a cargo do seu node Playwright (ou de um parser aqui).
 * Este arquivo só mostra a chamada da RPC.
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

/** @type {Array<Record<string, string>>} */
const exampleRows = [
  {
    CI: "4",
    Empresa: "BISMARCHI PIRES",
    Departamento: "Insolvência",
    Rateio: "",
    Nome: "Ana Clara Borba Tavares",
    Função: "Coordenador",
    Perfil: "COORDENADOR",
    "E-mail": "ana.tavares@bpplaw.com.br",
    Telefone: "",
    Celular: "",
    Situação: "Ativo",
  },
];

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc("import_hr_vios_employees", {
  p_rows: exampleRows,
});

if (error) {
  console.error("Falha no import:", error);
  process.exit(1);
}

console.log("Import OK:", data);
// { imported, matched, unmatched, updated, synced_at }
