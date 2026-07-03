/**
 * Sincroniza contatos do RD Station Marketing via OAuth.
 * Uso: node scripts/sync-rd-marketing.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { createClient } = require("@supabase/supabase-js");

const RD_AUTH_URL = "https://api.rd.services/auth/token";
const RD_API_BASE = "https://api.rd.services/platform";
const RD_OAUTH_SETTINGS_KEY = "rd_marketing_oauth";
const DEFAULT_SEGMENTATION_NAME = "Todos os contatos da base de Leads";
const CONCURRENCY = 2;

const MOJIBAKE_HINT = /[ÃÂâ€™â€œâ€]/;
const COMPANY_CANONICAL_GROUPS = [
  {
    canonicalName: "Bismarchi Pires",
    keys: ["bismarchi pires", "grupo bismarchi pires", "bismarchi pires sociedade de advogados", "bismarchi | pires"],
  },
];
const COMPANY_KEY_ALIASES = new Map();
for (const group of COMPANY_CANONICAL_GROUPS) {
  for (const key of group.keys) COMPANY_KEY_ALIASES.set(key, group.canonicalName.toLowerCase());
  COMPANY_KEY_ALIASES.set(group.canonicalName.toLowerCase(), group.canonicalName.toLowerCase());
}

function fixMojibake(value) {
  if (!value) return null;
  let text = String(value).replace(/\uFFFD/g, "").trim();
  if (!text) return null;
  for (let i = 0; i < 3; i++) {
    if (!MOJIBAKE_HINT.test(text)) break;
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8").decode(bytes).replace(/\uFFFD/g, "").trim();
    if (!decoded || decoded === text) break;
    text = decoded;
  }
  return text.trim() || null;
}

function collapseWhitespace(v) {
  return v.replace(/\s+/g, " ").trim();
}

function normalizePersonName(v) {
  const f = fixMojibake(v);
  return f ? collapseWhitespace(f) : null;
}

function normalizeCompanyName(v) {
  const f = fixMojibake(v);
  return f ? collapseWhitespace(f) : null;
}

function resolveCanonicalCompanyName(v) {
  const n = normalizeCompanyName(v);
  if (!n) return null;
  const key = n.toLowerCase().replace(/\|/g, " ").replace(/\s+/g, " ").trim();
  for (const group of COMPANY_CANONICAL_GROUPS) {
    if (group.keys.includes(key) || group.canonicalName.toLowerCase() === key) return group.canonicalName;
  }
  return n;
}

function companyNameKey(v) {
  const n = resolveCanonicalCompanyName(v) ?? normalizeCompanyName(v);
  if (!n) return null;
  const base = n.toLowerCase().replace(/\|/g, " ").replace(/\s+/g, " ").trim();
  return COMPANY_KEY_ALIASES.get(base) ?? base;
}

function normalizeTags(tags) {
  if (!tags?.length) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const t = normalizePersonName(raw);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) process.exit(1);
const admin = createClient(supabaseUrl, supabaseKey);

async function loadStoredRefreshToken() {
  const { data } = await admin.from("app_settings").select("value").eq("key", RD_OAUTH_SETTINGS_KEY).maybeSingle();
  return data?.value?.refresh_token ?? null;
}

async function saveRefreshToken(refreshToken) {
  await admin.from("app_settings").upsert(
    { key: RD_OAUTH_SETTINGS_KEY, value: { refresh_token: refreshToken, updated_at: new Date().toISOString() } },
    { onConflict: "key" }
  );
}

async function refreshToken() {
  const clientId = process.env.RD_MARKETING_CLIENT_ID;
  const clientSecret = process.env.RD_MARKETING_CLIENT_SECRET;
  const envRefresh = process.env.RD_MARKETING_REFRESH_TOKEN;
  const stored = await loadStoredRefreshToken();
  const refresh_token = stored ?? envRefresh;
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token, grant_type: "refresh_token" });
  const res = await fetch(RD_AUTH_URL, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? "token error");
  if (data.refresh_token && data.refresh_token !== refresh_token) await saveRefreshToken(data.refresh_token);
  return data.access_token;
}

async function rdFetch(path, token, retries = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${RD_API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
    let data;
    try { data = await res.json(); } catch { lastError = new Error(`RD invalid ${res.status}`); }
    if (res.ok) return data;
    lastError = new Error(data?.error_description ?? data?.message ?? `RD ${res.status}`);
    if (res.status >= 500 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      continue;
    }
    break;
  }
  throw lastError ?? new Error("RD fetch failed");
}

function pickCf(contact, keys) {
  for (const k of keys) {
    if (typeof contact[k] === "string" && contact[k].trim()) return contact[k].trim();
  }
  return null;
}

function mapStatus(legalBases) {
  const comm = legalBases?.find((b) => b.category === "communications");
  if (!comm) return undefined;
  return comm.status === "granted" ? "subscribed" : "unsubscribed";
}

async function upsertCompany(contact) {
  const raw = pickCf(contact, ["cf_grupo_empresa", "cf_empresa", "cf_razao_social"]);
  const name = resolveCanonicalCompanyName(raw);
  if (!name) return { companyId: null, companyName: null };
  const key = companyNameKey(name);
  const { data, error } = await admin
    .from("email_companies")
    .upsert(
      {
        name,
        name_normalized: key,
        city: normalizeCompanyName(pickCf(contact, ["cf_cidade_empresa", "cf_cidade"])),
        state: normalizeCompanyName(pickCf(contact, ["cf_estado_empresa", "cf_estado"])),
        cnpj: pickCf(contact, ["cf_cnpj"]),
        source: "rd-station",
      },
      { onConflict: "name_normalized" }
    )
    .select("id, name")
    .single();
  if (error) throw error;
  return { companyId: data.id, companyName: data.name };
}

async function main() {
  console.log("Renovando token...");
  const token = await refreshToken();

  const segs = await rdFetch("/segmentations?page=1&page_size=50", token);
  const segmentation =
    segs.segmentations.find((s) => s.name.toLowerCase() === DEFAULT_SEGMENTATION_NAME.toLowerCase()) ??
    segs.segmentations[0];
  console.log("Segmentação:", segmentation.name);

  const listed = [];
  let page = 1;
  while (true) {
    const data = await rdFetch(`/segmentations/${segmentation.id}/contacts?page=${page}&page_size=100`, token);
    const batch = data.contacts ?? [];
    if (!batch.length) break;
    listed.push(...batch);
    console.log(`Listados ${listed.length}...`);
    if (batch.length < 100) break;
    page++;
  }

  const { data: existingRows } = await admin.from("email_contacts").select("*");
  const byEmail = new Map((existingRows ?? []).map((r) => [String(r.email).toLowerCase(), r]));

  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < listed.length; i += CONCURRENCY) {
    const batch = listed.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        try {
          await new Promise((r) => setTimeout(r, 150));
          const detail = await rdFetch(`/contacts/${item.uuid}`, token);
          const email = detail.email?.trim().toLowerCase();
          if (!email) return;
          const existing = byEmail.get(email);
          const { companyId, companyName } = await upsertCompany(detail);
          const rdStatus = mapStatus(detail.legal_bases);
          const custom_fields = { ...(existing?.custom_fields ?? {}), rd_uuid: detail.uuid, rd_legal_bases: detail.legal_bases ?? [] };
          for (const [k, v] of Object.entries(detail)) {
            if (k.startsWith("cf_") && v != null && v !== "") custom_fields[k.replace(/^cf_/, "rd_")] = v;
          }
          const payload = {
            email,
            name: normalizePersonName(detail.name) ?? existing?.name ?? null,
            phone: fixMojibake(detail.mobile_phone) ?? fixMojibake(detail.personal_phone) ?? existing?.phone ?? null,
            company: companyName ?? existing?.company ?? null,
            company_id: companyId ?? existing?.company_id ?? null,
            tags: normalizeTags([...(existing?.tags ?? []), ...(detail.tags ?? [])]),
            status: rdStatus ?? existing?.status ?? "subscribed",
            source: existing?.source ?? "rd-station",
            custom_fields,
            rd_uuid: detail.uuid,
            rd_synced_at: new Date().toISOString(),
            unsubscribed_at: rdStatus === "unsubscribed" ? existing?.unsubscribed_at ?? new Date().toISOString() : rdStatus === "subscribed" ? null : existing?.unsubscribed_at ?? null,
          };
          const { error } = await admin.from("email_contacts").upsert(payload, { onConflict: "email" });
          if (error) throw error;
          upserted++;
        } catch (err) {
          errors++;
          if (errors <= 3) console.error("Erro:", err.message);
        }
      })
    );
    console.log(`Processados ${Math.min(i + CONCURRENCY, listed.length)}/${listed.length}`);
  }

  console.log("\nConcluído!");
  console.log(`  Listados: ${listed.length}`);
  console.log(`  Upserted: ${upserted}`);
  console.log(`  Erros: ${errors}`);

  const { data: bruno } = await admin.from("email_contacts").select("name, email").eq("email", "bruno.araujo@ma7negocios.com.br").maybeSingle();
  console.log("Bruno:", bruno);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
