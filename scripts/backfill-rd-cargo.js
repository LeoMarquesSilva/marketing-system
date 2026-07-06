/**
 * Preenche email_contacts.cargo a partir de custom_fields.rd_cargo_e_book (mapeado).
 *
 * Uso: node scripts/backfill-rd-cargo.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const CARGO_OPTIONS = [
  "Sócio(a) / Proprietário(a)",
  "Diretor(a)",
  "Gerente",
  "Coordenador(a)",
  "Financeiro",
  "Jurídico / Compliance",
  "Recursos Humanos",
  "Contabilidade",
  "Assistente / Secretário(a)",
  "Outro",
];
const CARGO_OUTRO = "Outro";

const CARGO_MATCH_RULES = [
  {
    option: "Sócio(a) / Proprietário(a)",
    keywords: ["socio", "socia", "proprietario", "proprietaria", "empresario", "empresaria", "owner", "founder", "filho do socio"],
  },
  { option: "Diretor(a)", keywords: ["diretor", "diretora", "ceo", "presidente", "superintendente", "executiv"] },
  { option: "Gerente", keywords: ["gerente", "gestor", "gestora", "supervisor", "supervisora", "supervisao"] },
  { option: "Coordenador(a)", keywords: ["coordenador", "coordenadora", "coordenacao"] },
  {
    option: "Financeiro",
    keywords: ["financeiro", "financeira", "financas", "tesouraria", "cobranca", "credito", "analista financeiro", "controladoria"],
  },
  {
    option: "Assistente / Secretário(a)",
    keywords: ["assistente", "secretario", "secretaria", "recepcionista", "auxiliar administrativo", "auxiliar de limpeza"],
  },
  {
    option: "Jurídico / Compliance",
    keywords: [
      "juridico",
      "juridica",
      "advogad",
      "compliance",
      "legal",
      "contrato",
      "insolvencia",
      "trabalhista",
      "tributari",
      "corporativ",
      "consultor juridic",
      "consultora juridic",
      "parceiro",
    ],
  },
  { option: "Recursos Humanos", keywords: ["recursos humanos", " rh", "rh ", "departamento pessoal", " dp ", "people"] },
  { option: "Contabilidade", keywords: ["contabil", "contador", "contadora", "fiscal"] },
  {
    option: "Assistente / Secretário(a)",
    keywords: ["assistente", "secretario", "secretaria", "recepcionista", "auxiliar administrativo", "auxiliar de limpeza"],
  },
];

const IGNORED = new Set(["n/a", "na", "-", "—", "null", "undefined"]);

function normalizeCargoKey(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cargoMatchesKeyword(normalizedCargo, keyword) {
  const kw = normalizeCargoKey(keyword);
  if (!kw) return false;
  const haystack = ` ${normalizedCargo} `;
  return haystack.includes(` ${kw} `) || normalizedCargo.startsWith(kw) || normalizedCargo.includes(kw);
}

function resolveCargoOption(cargo) {
  if (!cargo) return "";
  const trimmed = String(cargo).trim();
  if (!trimmed) return "";
  if (CARGO_OPTIONS.includes(trimmed)) return trimmed;
  const normalized = normalizeCargoKey(trimmed);
  if (IGNORED.has(normalized)) return "";
  for (const rule of CARGO_MATCH_RULES) {
    if (rule.keywords.some((kw) => cargoMatchesKeyword(normalized, kw))) return rule.option;
  }
  return CARGO_OUTRO;
}

function resolveCargoStoredValue(cargo) {
  if (!cargo) return null;
  const trimmed = String(cargo).trim();
  if (!trimmed) return null;
  if (IGNORED.has(normalizeCargoKey(trimmed))) return null;
  const option = resolveCargoOption(trimmed);
  return option === CARGO_OUTRO ? trimmed : option;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("email_contacts")
    .select("id, email, cargo, custom_fields")
    .not("custom_fields->>rd_cargo_e_book", "is", null);

  if (error) throw error;

  let updated = 0;
  let skipped = 0;

  for (const row of data ?? []) {
    if (row.cargo?.trim()) {
      skipped++;
      continue;
    }
    const rdCargo = row.custom_fields?.rd_cargo_e_book;
    const mapped = resolveCargoStoredValue(rdCargo);
    if (!mapped) {
      skipped++;
      continue;
    }
    const { error: upErr } = await admin.from("email_contacts").update({ cargo: mapped }).eq("id", row.id);
    if (upErr) throw upErr;
    updated++;
  }

  console.log(`Backfill cargo: ${updated} atualizados, ${skipped} ignorados (total ${data?.length ?? 0})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
