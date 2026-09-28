import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(path.resolve(".env"));
loadEnv(path.resolve(".env.local"));

const SMALL = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "para",
  "por",
  "com",
  "del",
  "la",
  "y",
]);

function toTitleCasePt(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && SMALL.has(lower)) return lower;
      if (/^(oab|mba|fgv|puc|esa|epd|ebradi|trf|trt|stf|stj)$/i.test(word)) {
        return word.toLocaleUpperCase("pt-BR");
      }
      return word
        .split("-")
        .map((part) => {
          const l = part.toLocaleLowerCase("pt-BR");
          return l.charAt(0).toLocaleUpperCase("pt-BR") + l.slice(1);
        })
        .join("-");
    })
    .join(" ");
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await db
  .from("professional_profile_localizations")
  .select("id, display_name, role, practice_area");

if (error) throw error;

let updated = 0;
for (const row of data || []) {
  const patch = {
    display_name: toTitleCasePt(row.display_name),
    role: toTitleCasePt(row.role),
    practice_area: toTitleCasePt(row.practice_area),
  };
  if (
    patch.display_name === row.display_name &&
    patch.role === row.role &&
    patch.practice_area === row.practice_area
  ) {
    continue;
  }
  const { error: updateError } = await db
    .from("professional_profile_localizations")
    .update(patch)
    .eq("id", row.id);
  if (updateError) throw updateError;
  updated += 1;
}

console.log(JSON.stringify({ total: (data || []).length, updated }, null, 2));
