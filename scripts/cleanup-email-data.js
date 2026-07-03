/**
 * Limpa encoding quebrado, normaliza nomes e funde empresas duplicadas.
 *
 * Uso: node scripts/cleanup-email-data.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const MOJIBAKE_HINT = /[ÃÂâ€™â€œâ€�]/;

const COMPANY_CANONICAL_GROUPS = [
  {
    canonicalName: "Bismarchi Pires",
    keys: [
      "bismarchi pires",
      "grupo bismarchi pires",
      "bismarchi pires sociedade de advogados",
      "bismarchi | pires",
    ],
  },
];

const COMPANY_KEY_ALIASES = new Map();
for (const group of COMPANY_CANONICAL_GROUPS) {
  const canonicalKey = group.canonicalName.toLowerCase();
  for (const key of group.keys) COMPANY_KEY_ALIASES.set(key, canonicalKey);
  COMPANY_KEY_ALIASES.set(canonicalKey, canonicalKey);
}

function decodeLatin1AsUtf8(text) {
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
  return new TextDecoder("utf-8").decode(bytes).replace(/\uFFFD/g, "").trim();
}

function manualMojibakeFix(text) {
  return text
    .replace(/Ã¡/g, "á")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã§/g, "ç")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã�/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã"/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‡/g, "Ç")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/�/g, "");
}

function fixMojibake(value) {
  if (!value) return null;
  let text = String(value).replace(/\uFFFD/g, "").trim();
  if (!text) return null;
  for (let i = 0; i < 3; i++) {
    if (!MOJIBAKE_HINT.test(text)) break;
    const decoded = decodeLatin1AsUtf8(text);
    if (!decoded || decoded === text) break;
    text = decoded;
  }
  if (MOJIBAKE_HINT.test(text)) text = manualMojibakeFix(text);
  return text.trim() || null;
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePersonName(value) {
  const fixed = fixMojibake(value);
  return fixed ? collapseWhitespace(fixed) : null;
}

function normalizeCompanyName(value) {
  const fixed = fixMojibake(value);
  return fixed ? collapseWhitespace(fixed) : null;
}

function baseCompanyKey(value) {
  const normalized = normalizeCompanyName(value);
  if (!normalized) return null;
  return normalized.toLowerCase().replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

function companyNameKey(value) {
  const base = baseCompanyKey(value);
  if (!base) return null;
  return COMPANY_KEY_ALIASES.get(base) ?? base;
}

function resolveCanonicalCompanyName(value) {
  const normalized = normalizeCompanyName(value);
  if (!normalized) return null;
  const key = companyNameKey(normalized);
  for (const group of COMPANY_CANONICAL_GROUPS) {
    if (group.keys.includes(key) || group.canonicalName.toLowerCase() === key) {
      return group.canonicalName;
    }
  }
  return normalized;
}

function normalizeTags(tags) {
  if (!tags?.length) return [];
  const seen = new Set();
  const result = [];
  for (const raw of tags) {
    const tag = fixMojibake(raw);
    if (!tag) continue;
    const cleaned = collapseWhitespace(tag);
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function normalizeCustomFields(fields) {
  if (!fields) return {};
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") {
      const fixed = fixMojibake(value);
      if (fixed) result[key] = fixed;
    } else if (value != null) result[key] = value;
  }
  return result;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey);

async function fetchAll(table, select) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function fixContacts() {
  const contacts = await fetchAll("email_contacts", "id, name, company, tags, custom_fields");
  let updated = 0;
  for (const contact of contacts) {
    const name = normalizePersonName(contact.name);
    const company = normalizeCompanyName(contact.company);
    const tags = normalizeTags(contact.tags);
    const custom_fields = normalizeCustomFields(contact.custom_fields);
    const changed =
      name !== (contact.name ?? null) ||
      company !== (contact.company ?? null) ||
      JSON.stringify(tags) !== JSON.stringify(contact.tags ?? []) ||
      JSON.stringify(custom_fields) !== JSON.stringify(contact.custom_fields ?? {});

    if (!changed) continue;

    const { error } = await admin
      .from("email_contacts")
      .update({ name, company, tags, custom_fields })
      .eq("id", contact.id);
    if (error) throw new Error(error.message);
    updated++;
  }
  console.log(`Contatos com texto corrigido: ${updated}`);
  return updated;
}

async function fixCompaniesText() {
  const companies = await fetchAll("email_companies", "id, name, city, state, country, website, linkedin, cnpj");
  let updated = 0;
  for (const company of companies) {
    const name = normalizeCompanyName(company.name);
    const payload = {
      name,
      city: fixMojibake(company.city),
      state: fixMojibake(company.state),
      country: fixMojibake(company.country),
      website: fixMojibake(company.website),
      linkedin: fixMojibake(company.linkedin),
      cnpj: fixMojibake(company.cnpj),
    };
    const changed = Object.entries(payload).some(([k, v]) => v !== (company[k] ?? null));
    if (!changed) continue;
    const { error } = await admin.from("email_companies").update(payload).eq("id", company.id);
    if (error) throw new Error(error.message);
    updated++;
  }
  console.log(`Empresas com texto corrigido: ${updated}`);
}

async function mergeDuplicateCompanies() {
  const companies = await fetchAll(
    "email_companies",
    "id, name, name_normalized, city, state, country, website, linkedin, cnpj, source"
  );

  const groups = new Map();
  for (const company of companies) {
    const key = companyNameKey(company.name) ?? company.name_normalized;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(company);
  }

  let mergedGroups = 0;
  let deletedCompanies = 0;
  let relinkedContacts = 0;

  for (const [key, members] of groups) {
    if (members.length <= 1) {
      const only = members[0];
      const canonicalName = resolveCanonicalCompanyName(only.name) ?? normalizeCompanyName(only.name);
      const canonicalKey = companyNameKey(canonicalName) ?? key;
      if (canonicalName !== only.name || canonicalKey !== only.name_normalized) {
        await admin
          .from("email_companies")
          .update({ name: canonicalName, name_normalized: canonicalKey })
          .eq("id", only.id);
      }
      continue;
    }

    mergedGroups++;
    const canonicalName = resolveCanonicalCompanyName(members[0].name) ?? normalizeCompanyName(members[0].name);
    const canonicalKey = companyNameKey(canonicalName) ?? key;

    members.sort((a, b) => {
      const score = (c) =>
        (c.city ? 1 : 0) +
        (c.state ? 1 : 0) +
        (c.cnpj ? 2 : 0) +
        (c.website ? 1 : 0);
      return score(b) - score(a);
    });

    const survivor = members[0];
    const merged = {
      name: canonicalName,
      name_normalized: canonicalKey,
      city: members.map((m) => fixMojibake(m.city)).find(Boolean) ?? null,
      state: members.map((m) => fixMojibake(m.state)).find(Boolean) ?? null,
      country: members.map((m) => fixMojibake(m.country)).find(Boolean) ?? null,
      website: members.map((m) => fixMojibake(m.website)).find(Boolean) ?? null,
      linkedin: members.map((m) => fixMojibake(m.linkedin)).find(Boolean) ?? null,
      cnpj: members.map((m) => fixMojibake(m.cnpj)).find(Boolean) ?? null,
      source: survivor.source ?? "rd-station",
    };

    const { data: upserted, error: upsertError } = await admin
      .from("email_companies")
      .upsert(merged, { onConflict: "name_normalized" })
      .select("id")
      .single();
    if (upsertError) throw new Error(upsertError.message);

    const survivorId = upserted.id;

    for (const duplicate of members) {
      if (duplicate.id === survivorId) {
        await admin.from("email_companies").update(merged).eq("id", survivorId);
        continue;
      }

      const { data: contacts, error: contactsError } = await admin
        .from("email_contacts")
        .select("id")
        .eq("company_id", duplicate.id);
      if (contactsError) throw new Error(contactsError.message);

      if (contacts?.length) {
        const { error: relinkError } = await admin
          .from("email_contacts")
          .update({ company_id: survivorId, company: canonicalName })
          .eq("company_id", duplicate.id);
        if (relinkError) throw new Error(relinkError.message);
        relinkedContacts += contacts.length;
      }

      const { error: deleteError } = await admin.from("email_companies").delete().eq("id", duplicate.id);
      if (deleteError) throw new Error(deleteError.message);
      deletedCompanies++;
    }

    console.log(`  Fundido: ${canonicalName} (${members.length} registros → 1)`);
  }

  console.log(`Grupos fundidos: ${mergedGroups}`);
  console.log(`Empresas removidas: ${deletedCompanies}`);
  console.log(`Contatos re-vinculados: ${relinkedContacts}`);
}

async function relinkContactsToCanonicalCompanies() {
  const contacts = await fetchAll("email_contacts", "id, company, company_id");
  const companies = await fetchAll("email_companies", "id, name, name_normalized");
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const companyByKey = new Map(companies.map((c) => [c.name_normalized, c]));

  let updated = 0;
  for (const contact of contacts) {
    const companyText = normalizeCompanyName(contact.company);
    if (!companyText) continue;

    const key = companyNameKey(companyText);
    const canonicalName = resolveCanonicalCompanyName(companyText) ?? companyText;
    const target = key ? companyByKey.get(key) : null;
    const current = contact.company_id ? companyById.get(contact.company_id) : null;

    const needsUpdate =
      !target ||
      contact.company_id !== target.id ||
      contact.company !== canonicalName ||
      (current && current.name !== canonicalName);

    if (!needsUpdate) continue;

    let companyId = target?.id ?? null;
    if (!companyId && key) {
      const { data, error } = await admin
        .from("email_companies")
        .upsert(
          { name: canonicalName, name_normalized: key, source: "rd-station" },
          { onConflict: "name_normalized" }
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      companyId = data.id;
      companyByKey.set(key, { id: companyId, name: canonicalName, name_normalized: key });
    }

    const { error } = await admin
      .from("email_contacts")
      .update({ company_id: companyId, company: canonicalName })
      .eq("id", contact.id);
    if (error) throw new Error(error.message);
    updated++;
  }
  console.log(`Contatos re-sincronizados com empresas: ${updated}`);
}

async function main() {
  console.log("1/4 Corrigindo encoding de contatos...");
  await fixContacts();

  console.log("2/4 Corrigindo encoding de empresas...");
  await fixCompaniesText();

  console.log("3/4 Fundindo empresas duplicadas...");
  await mergeDuplicateCompanies();

  console.log("4/4 Re-vinculando contatos...");
  await relinkContactsToCanonicalCompanies();

  const { data: bismarchi } = await admin
    .from("email_companies")
    .select("id, name, email_contacts(count)")
    .ilike("name", "%bismarchi%");

  console.log("\nEmpresas Bismarchi após limpeza:");
  for (const row of bismarchi ?? []) {
    console.log(`  - ${row.name}: ${row.email_contacts?.[0]?.count ?? 0} contatos`);
  }

  const { count: badNames } = await admin
    .from("email_contacts")
    .select("id", { count: "exact", head: true })
    .or("name.like.%Ã%,name.like.%Â%");
  console.log(`\nContatos ainda com encoding quebrado no nome: ${badNames ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
