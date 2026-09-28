/**
 * One-off controlled import for Task 14. Not for commit.
 * Preview + apply only selectedByDefault rows (active matches) as drafts.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { pathToFileURL } from "node:url";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i);
    let value = trimmed.slice(i + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(path.resolve(".env"));
loadEnv(path.resolve(".env.local"));

const WORKBOOK =
  process.env.COLLABORATORS_XLSM ||
  String.raw`C:\Users\Leonardo Marques\Downloads\Colaboradores-MKT.xlsm`;
const ACTOR_ID = "2f08c695-770e-47ce-b4e4-ce27fa414df8"; // Leonardo Marques (admin)
const APPLY = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

// Import compiled TS via vitest/vite transform is heavy; re-use source through dynamic import of built helpers.
// Prefer calling the same pure functions by spawning tsx if available; fallback: inline via node --experimental.
const importUrl = pathToFileURL(path.resolve("src/lib/profiles/import.ts")).href;

async function main() {
  let parseCollaboratorWorkbook, buildImportPreview, buildImportPayload;
  try {
    const mod = await import(importUrl);
    parseCollaboratorWorkbook = mod.parseCollaboratorWorkbook;
    buildImportPreview = mod.buildImportPreview;
    buildImportPayload = mod.buildImportPayload;
  } catch (error) {
    console.error("Failed to import TS module directly:", error.message);
    console.error("Retry with: npx tsx .codex-tmp/run-profile-import.ts");
    process.exit(1);
  }

  const buffer = fs.readFileSync(WORKBOOK);
  const rows = parseCollaboratorWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  console.log("workbook_rows", rows.length);
  console.log("active_source", rows.filter((r) => r.sourceIsActive).length);
  console.log("inactive_source", rows.filter((r) => !r.sourceIsActive).length);

  // Privacy check: birth date must never appear in parsed rows
  const sample = JSON.stringify(rows.slice(0, 3));
  if (/nasc|birth|cpf/i.test(sample)) {
    console.error("PRIVACY FAIL: sensitive field leaked into parsed rows");
    process.exit(2);
  }
  console.log("privacy_ok_no_dob_in_sample");

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: userRows, error: userError }, { data: profileRows, error: profileError }] =
    await Promise.all([
      db.from("users").select("id, email, name"),
      db
        .from("professional_profiles")
        .select("id, user_id, slug, professional_email, professional_phone, joined_on"),
    ]);
  if (userError || profileError) {
    console.error(userError || profileError);
    process.exit(1);
  }

  const profileIds = (profileRows ?? []).map((p) => p.id);
  let localizationRows = [];
  if (profileIds.length) {
    const { data, error } = await db
      .from("professional_profile_localizations")
      .select("profile_id, locale, display_name, role, practice_area")
      .eq("locale", "pt-BR")
      .in("profile_id", profileIds);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    localizationRows = data ?? [];
  }

  const userIdByProfileId = new Map((profileRows ?? []).map((p) => [p.id, p.user_id]));
  const localizationByUserId = new Map();
  for (const row of localizationRows) {
    const userId = userIdByProfileId.get(row.profile_id);
    if (userId) localizationByUserId.set(userId, row);
  }

  const users = (userRows ?? []).map((row) => ({
    id: row.id,
    email: row.email ?? null,
    name: row.name ?? null,
  }));
  const profiles = (profileRows ?? []).map((row) => {
    const localization = localizationByUserId.get(row.user_id);
    return {
      userId: row.user_id,
      slug: row.slug,
      professionalEmail: row.professional_email,
      professionalPhone: row.professional_phone,
      joinedOn: row.joined_on,
      displayName: localization?.display_name ?? null,
      role: localization?.role ?? null,
      practiceArea: localization?.practice_area ?? null,
    };
  });

  const preview = buildImportPreview(rows, users, profiles);
  const counts = {};
  for (const row of preview.rows) {
    counts[row.outcome] = (counts[row.outcome] ?? 0) + 1;
  }
  console.log("preview_counts", counts);
  console.log("selected_by_default", preview.rows.filter((r) => r.selectedByDefault).length);

  const selectedEmails = preview.rows
    .filter((r) => r.selectedByDefault && (r.outcome === "create" || r.outcome === "update"))
    .map((r) => r.email);

  console.log("selected_for_apply", selectedEmails.length);

  if (!APPLY) {
    console.log("dry_run_only (pass --apply to write drafts)");
    return;
  }

  const payload = buildImportPayload(preview, selectedEmails, false);
  console.log("payload_rows", payload.length);

  const { data, error } = await db.rpc("apply_professional_profile_import", {
    p_rows: payload,
    p_actor_id: ACTOR_ID,
  });
  if (error) {
    console.error("apply_failed", error);
    process.exit(1);
  }
  console.log("apply_result", data);

  const { count: draftCount } = await db
    .from("professional_profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const { count: publishedCount } = await db
    .from("professional_profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  console.log("profiles_draft", draftCount);
  console.log("profiles_published", publishedCount);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
