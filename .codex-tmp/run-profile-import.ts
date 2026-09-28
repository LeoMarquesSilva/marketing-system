/**
 * One-off controlled import for Task 14. Do not commit.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildImportPayload,
  buildImportPreview,
  parseCollaboratorWorkbook,
} from "../src/lib/profiles/import";

function loadEnv(filePath: string) {
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
  "C:\\Users\\Leonardo Marques\\Downloads\\Colaboradores-MKT.xlsm";
const ACTOR_ID = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const APPLY = process.argv.includes("--apply");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const buffer = fs.readFileSync(WORKBOOK);
  const rows = parseCollaboratorWorkbook(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );

  console.log(
    JSON.stringify({
      workbook_rows: rows.length,
      active_source: rows.filter((r) => r.sourceIsActive).length,
      inactive_source: rows.filter((r) => !r.sourceIsActive).length,
    })
  );

  const sample = JSON.stringify(rows.slice(0, 5));
  if (/DATA DE NASC|cpf|birth/i.test(sample)) {
    throw new Error("PRIVACY FAIL: sensitive field in parsed rows");
  }

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
  if (userError) throw userError;
  if (profileError) throw profileError;

  const profileIds = (profileRows ?? []).map((p) => p.id as string);
  let localizationRows: Array<Record<string, unknown>> = [];
  if (profileIds.length) {
    const { data, error } = await db
      .from("professional_profile_localizations")
      .select("profile_id, locale, display_name, role, practice_area")
      .eq("locale", "pt-BR")
      .in("profile_id", profileIds);
    if (error) throw error;
    localizationRows = (data ?? []) as Array<Record<string, unknown>>;
  }

  const userIdByProfileId = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p.user_id as string])
  );
  const localizationByUserId = new Map<string, Record<string, unknown>>();
  for (const row of localizationRows) {
    const userId = userIdByProfileId.get(row.profile_id as string);
    if (userId) localizationByUserId.set(userId, row);
  }

  const users = (userRows ?? []).map((row) => ({
    id: row.id as string,
    email: (row.email as string | null) ?? null,
    name: (row.name as string | null) ?? null,
  }));

  const profiles = (profileRows ?? []).map((row) => {
    const localization = localizationByUserId.get(row.user_id as string);
    return {
      userId: row.user_id as string,
      slug: row.slug as string,
      professionalEmail: (row.professional_email as string | null) ?? null,
      professionalPhone: (row.professional_phone as string | null) ?? null,
      joinedOn: (row.joined_on as string | null) ?? null,
      displayName: (localization?.display_name as string | null) ?? null,
      role: (localization?.role as string | null) ?? null,
      practiceArea: (localization?.practice_area as string | null) ?? null,
    };
  });

  const preview = buildImportPreview(rows, users, profiles);
  const counts: Record<string, number> = {};
  for (const row of preview.rows) {
    counts[row.outcome] = (counts[row.outcome] ?? 0) + 1;
  }

  const selectedEmails = preview.rows
    .filter((r) => r.selectedByDefault && (r.outcome === "create" || r.outcome === "update"))
    .map((r) => r.email);

  console.log(
    JSON.stringify({
      preview_counts: counts,
      selected_by_default: preview.rows.filter((r) => r.selectedByDefault).length,
      selected_for_apply: selectedEmails.length,
      unmatched_sample: preview.rows
        .filter((r) => r.outcome === "unmatched")
        .slice(0, 8)
        .map((r) => r.email),
    })
  );

  if (!APPLY) {
    console.log("dry_run_only");
    return;
  }

  const payload = buildImportPayload(preview, selectedEmails, false);
  const { data, error } = await db.rpc("apply_professional_profile_import", {
    p_rows: payload,
    p_actor_id: ACTOR_ID,
  });
  if (error) throw error;

  const { count: draftCount } = await db
    .from("professional_profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const { count: publishedCount } = await db
    .from("professional_profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  console.log(
    JSON.stringify({
      apply_result: data,
      profiles_draft: draftCount,
      profiles_published: publishedCount,
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
