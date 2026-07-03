/**
 * Normaliza tags/contatos e cria empresas a partir do campo company + custom_fields.
 *
 * Uso: node scripts/backfill-email-companies.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const MOJIBAKE_HINT = /[ÃÂâ€™â€œâ€]/;

function fixMojibake(value) {
  if (!value) return null;
  const text = String(value).replace(/\uFFFD/g, "").trim();
  if (!text) return null;
  if (!MOJIBAKE_HINT.test(text)) return text;
  try {
    const fixed = Buffer.from(text, "latin1").toString("utf8").replace(/\uFFFD/g, "").trim();
    if (fixed) return fixed;
  } catch {}
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
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"');
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCompanyName(value) {
  const fixed = fixMojibake(value);
  if (!fixed) return null;
  return collapseWhitespace(fixed);
}

function companyNameKey(value) {
  const normalized = normalizeCompanyName(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeTag(value) {
  const fixed = fixMojibake(value);
  if (!fixed) return null;
  return collapseWhitespace(fixed);
}

function normalizeTags(tags) {
  if (!tags?.length) return [];
  const seen = new Set();
  const result = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
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

async function fetchAllContacts() {
  const all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await admin
      .from("email_contacts")
      .select("id, email, company, tags, custom_fields, company_id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function pickCompanyName(contact) {
  const fromField = normalizeCompanyName(contact.company);
  const cf = contact.custom_fields ?? {};
  const fromCustom =
    normalizeCompanyName(cf.grupo_empresa) ||
    normalizeCompanyName(cf.razao_social) ||
    normalizeCompanyName(cf.empresa);
  return fromField || fromCustom || null;
}

function mergeCompanyData(existing, contact) {
  const cf = contact.custom_fields ?? {};
  const name = pickCompanyName(contact);
  if (!name) return existing;

  const key = companyNameKey(name);
  if (!key) return existing;

  const current = existing.get(key) ?? {
    name,
    name_normalized: key,
    city: null,
    state: null,
    country: null,
    website: null,
    linkedin: null,
    cnpj: null,
    source: "rd-station",
    count: 0,
  };

  current.count++;
  if (name.length > current.name.length) current.name = name;
  current.city = current.city || fixMojibake(cf.cidade) || null;
  current.state = current.state || fixMojibake(cf.estado) || null;
  current.country = current.country || fixMojibake(cf.pais) || null;
  current.website = current.website || fixMojibake(cf.website) || null;
  current.linkedin = current.linkedin || fixMojibake(cf.linkedin) || null;
  current.cnpj = current.cnpj || fixMojibake(cf.cnpj) || null;

  existing.set(key, current);
  return existing;
}

async function main() {
  console.log("Carregando contatos...");
  const contacts = await fetchAllContacts();
  console.log(`Contatos encontrados: ${contacts.length}`);

  let tagsUpdated = 0;
  const companyMap = new Map();

  for (const contact of contacts) {
    const normalizedTags = normalizeTags(contact.tags);
    const tagsChanged = JSON.stringify(normalizedTags) !== JSON.stringify(contact.tags ?? []);
    if (tagsChanged) tagsUpdated++;

    const companyName = pickCompanyName(contact);
    if (companyName) mergeCompanyData(companyMap, contact);

    contact._normalizedTags = normalizedTags;
    contact._companyName = companyName;
    contact._companyKey = companyName ? companyNameKey(companyName) : null;
  }

  console.log(`Tags a normalizar: ${tagsUpdated}`);
  console.log(`Empresas únicas: ${companyMap.size}`);

  const companies = [...companyMap.values()].map(({ count: _count, ...company }) => company);
  let companyIdByKey = new Map();

  for (let i = 0; i < companies.length; i += 100) {
    const batch = companies.slice(i, i + 100);
    const { data, error } = await admin
      .from("email_companies")
      .upsert(batch, { onConflict: "name_normalized" })
      .select("id, name_normalized");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      companyIdByKey.set(row.name_normalized, row.id);
    }
    console.log(`Empresas upsert: ${Math.min(i + 100, companies.length)}/${companies.length}`);
  }

  const { data: allCompanies, error: companiesError } = await admin
    .from("email_companies")
    .select("id, name_normalized");
  if (companiesError) throw new Error(companiesError.message);
  companyIdByKey = new Map(allCompanies.map((c) => [c.name_normalized, c.id]));

  let contactsUpdated = 0;
  for (let i = 0; i < contacts.length; i += 100) {
    const batch = contacts.slice(i, i + 100);
    const updates = batch.map((contact) => {
      const companyId = contact._companyKey ? companyIdByKey.get(contact._companyKey) ?? null : null;
      return {
        id: contact.id,
        tags: contact._normalizedTags,
        company: contact._companyName,
        company_id: companyId,
      };
    });

    for (const update of updates) {
      const { error } = await admin
        .from("email_contacts")
        .update({
          tags: update.tags,
          company: update.company,
          company_id: update.company_id,
        })
        .eq("id", update.id);
      if (error) throw new Error(error.message);
      contactsUpdated++;
    }
    console.log(`Contatos atualizados: ${Math.min(i + 100, contacts.length)}/${contacts.length}`);
  }

  console.log("\nConcluído!");
  console.log(`  Tags normalizadas em ${tagsUpdated} contatos`);
  console.log(`  ${companies.length} empresas criadas/atualizadas`);
  console.log(`  ${contactsUpdated} contatos vinculados`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
