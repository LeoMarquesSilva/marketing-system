import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { getServerDb } from "@/lib/users-server";
import { loadPeopleDirectory } from "@/lib/rh/people-directory";
import { awardPhotoUrl } from "@/lib/rh/bp-awards/format";
import {
  BIRTHDAY_ARTS_BUCKET,
  BIRTHDAY_ART_KINDS,
  BIRTHDAY_ART_MAX_BYTES,
  BIRTHDAY_ART_TYPES,
  canManageBirthdayArts,
  parseMonth,
  type BirthdayArtKind,
  type BirthdayArtRow,
  type BirthdayArtsMonth,
  type BirthdayArtType,
} from "./birthday-arts";

const LOG = "artes-aniversario";
/** Validade do link assinado (a tela pede outro a cada visita). */
const ART_URL_SECONDS = 60 * 60;
const EXTENSION: Record<BirthdayArtType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export class BirthdayArtHttpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "BirthdayArtHttpError";
  }
}

/** Só admin e Marketing gerenciam as artes. Devolve o banco (service role) e o id do usuário. */
async function requireArtsManager(): Promise<{ db: SupabaseClient; profileId: string }> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new BirthdayArtHttpError("Não autenticado.", 401);
  const db = (await getServerDb()) as SupabaseClient;
  const { data } = await db.from("users").select("id, role, department, is_active").eq("auth_id", user.id).maybeSingle();
  if (!data || data.is_active === false) throw new BirthdayArtHttpError("Usuário não encontrado.", 404);
  if (!canManageBirthdayArts(data as { role: string | null; department: string | null })) {
    throw new BirthdayArtHttpError("Só o Marketing gerencia as artes de aniversário.", 403);
  }
  return { db, profileId: data.id as string };
}

export const artKey = (employeeId: string, kind: BirthdayArtKind, year: number) => `${employeeId}:${kind}:${year}`;

/**
 * Links assinados das artes já enviadas para as comemorações pedidas
 * (chave: `artKey`). Falha de leitura devolve vazio: a tela segue sem a arte.
 */
export async function signedArtUrls(
  db: SupabaseClient,
  wanted: Array<{ employeeId: string; kind: BirthdayArtKind; year: number }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (wanted.length === 0) return result;
  const { data, error } = await db
    .from("hr_birthday_arts")
    .select("employee_id, kind, year, storage_path")
    .in("employee_id", [...new Set(wanted.map((item) => item.employeeId))])
    .in("year", [...new Set(wanted.map((item) => item.year))]);
  if (error) {
    console.error(`[${LOG}] leitura:`, error.message);
    return result;
  }
  const wantedKeys = new Set(wanted.map((item) => artKey(item.employeeId, item.kind, item.year)));
  const rows = (data ?? []).filter((row) => wantedKeys.has(artKey(row.employee_id as string, row.kind as BirthdayArtKind, row.year as number)));
  if (rows.length === 0) return result;
  const { data: signed, error: signError } = await db.storage
    .from(BIRTHDAY_ARTS_BUCKET)
    .createSignedUrls(rows.map((row) => row.storage_path as string), ART_URL_SECONDS);
  if (signError) {
    console.error(`[${LOG}] links:`, signError.message);
    return result;
  }
  const byPath = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));
  for (const row of rows) {
    const url = byPath.get(row.storage_path as string);
    if (url) result.set(artKey(row.employee_id as string, row.kind as BirthdayArtKind, row.year as number), url);
  }
  return result;
}

/** Quem faz aniversário (da pessoa e de empresa) no mês, com a arte de cada um quando já foi enviada. */
export async function listMonthArts(monthInput: string | null): Promise<BirthdayArtsMonth> {
  const { db } = await requireArtsManager();
  const parsed = parseMonth(monthInput);
  if (!parsed) throw new BirthdayArtHttpError("Mês inválido.", 400);
  const { year, month } = parsed;

  const [directory, datesResult] = await Promise.all([
    loadPeopleDirectory(db, LOG),
    db.from("hr_employees").select("id, birth_date, admission_date").eq("is_active", true),
  ]);
  if (datesResult.error) throw new BirthdayArtHttpError("Não foi possível carregar os aniversariantes.", 500);
  const people = new Map(directory.filter((person) => person.is_active).map((person) => [person.id, person]));

  const rows: BirthdayArtRow[] = [];
  for (const row of (datesResult.data ?? []) as Array<{ id: string; birth_date: string | null; admission_date: string | null }>) {
    const person = people.get(row.id);
    if (!person) continue;
    const base = {
      employeeId: person.id,
      name: person.short_name,
      department: person.department,
      avatarUrl: awardPhotoUrl(person.avatar_url, 96),
      year,
      artUrl: null,
    };
    if (row.birth_date && Number(row.birth_date.slice(5, 7)) === month) {
      rows.push({ ...base, kind: "aniversario", day: Number(row.birth_date.slice(8, 10)), years: null });
    }
    if (row.admission_date && Number(row.admission_date.slice(5, 7)) === month) {
      const years = year - Number(row.admission_date.slice(0, 4));
      if (years >= 1) rows.push({ ...base, kind: "empresa", day: Number(row.admission_date.slice(8, 10)), years });
    }
  }

  const urls = await signedArtUrls(db, rows.map((row) => ({ employeeId: row.employeeId, kind: row.kind, year: row.year })));
  for (const row of rows) row.artUrl = urls.get(artKey(row.employeeId, row.kind, row.year)) ?? null;
  rows.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, "pt-BR"));
  return { month: `${year}-${String(month).padStart(2, "0")}`, rows };
}

const targetSchema = z.object({
  employeeId: z.string().uuid("Pessoa inválida."),
  kind: z.enum(BIRTHDAY_ART_KINDS as [BirthdayArtKind, ...BirthdayArtKind[]], { message: "Tipo de arte inválido." }),
  year: z.number().int().min(2020).max(2100),
});
const fileSchema = z.object({
  content_type: z.enum(BIRTHDAY_ART_TYPES, { message: "Envie a arte em PNG, JPG ou WebP." }),
  size_bytes: z.number().int().positive().max(BIRTHDAY_ART_MAX_BYTES, "A arte passa de 10 MB."),
});
const uploadSchema = targetSchema.extend(fileSchema.shape);
const registerSchema = uploadSchema.extend({ storage_path: z.string().min(1).max(300) });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BirthdayArtHttpError(result.error.issues[0]?.message ?? "Dados inválidos.", 400);
  return result.data;
}

const folderOf = (target: { employeeId: string; kind: BirthdayArtKind; year: number }) =>
  `${target.year}/${target.kind}/${target.employeeId}/`;

async function ensureEmployee(db: SupabaseClient, employeeId: string): Promise<void> {
  const { data } = await db.from("hr_employees").select("id").eq("id", employeeId).maybeSingle();
  if (!data) throw new BirthdayArtHttpError("Pessoa não encontrada no cadastro.", 404);
}

/** Link assinado para o navegador subir a arte direto no bucket privado. */
export async function createArtUpload(input: unknown): Promise<{ path: string; token: string }> {
  const { db } = await requireArtsManager();
  const value = parse(uploadSchema, input);
  await ensureEmployee(db, value.employeeId);
  const path = `${folderOf(value)}${crypto.randomUUID()}.${EXTENSION[value.content_type]}`;
  const { data, error } = await db.storage.from(BIRTHDAY_ARTS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error(`[${LOG}] upload assinado:`, error?.message);
    throw new BirthdayArtHttpError("Não foi possível preparar o envio da arte.", 500);
  }
  return { path: data.path, token: data.token };
}

/** Registra a arte já enviada; se a pessoa já tinha arte naquele ano, a nova substitui a antiga. */
export async function registerArt(input: unknown): Promise<{ artUrl: string }> {
  const { db, profileId } = await requireArtsManager();
  const value = parse(registerSchema, input);
  if (!value.storage_path.startsWith(folderOf(value)) || value.storage_path.includes("..")) {
    throw new BirthdayArtHttpError("Arquivo de outra pessoa ou de outro ano.", 400);
  }
  await ensureEmployee(db, value.employeeId);

  const { data: previous } = await db
    .from("hr_birthday_arts")
    .select("storage_path")
    .eq("employee_id", value.employeeId)
    .eq("kind", value.kind)
    .eq("year", value.year)
    .maybeSingle();

  const { data: signed, error: signError } = await db.storage
    .from(BIRTHDAY_ARTS_BUCKET)
    .createSignedUrl(value.storage_path, ART_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    throw new BirthdayArtHttpError("A arte não chegou ao armazenamento. Tente de novo.", 500);
  }

  const { error } = await db.from("hr_birthday_arts").upsert(
    {
      employee_id: value.employeeId,
      kind: value.kind,
      year: value.year,
      storage_path: value.storage_path,
      content_type: value.content_type,
      size_bytes: value.size_bytes,
      created_by: profileId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,kind,year" }
  );
  if (error) {
    console.error(`[${LOG}] registro:`, error.message);
    throw new BirthdayArtHttpError("Não foi possível registrar a arte.", 500);
  }

  const oldPath = previous?.storage_path as string | undefined;
  if (oldPath && oldPath !== value.storage_path) {
    const { error: removeError } = await db.storage.from(BIRTHDAY_ARTS_BUCKET).remove([oldPath]);
    if (removeError) console.error(`[${LOG}] arquivo antigo:`, removeError.message);
  }
  return { artUrl: signed.signedUrl };
}

/** Remove a arte de uma pessoa naquele ano (registro e arquivo). */
export async function deleteArt(input: unknown): Promise<void> {
  const { db } = await requireArtsManager();
  const value = parse(targetSchema, input);
  const { data, error } = await db
    .from("hr_birthday_arts")
    .delete()
    .eq("employee_id", value.employeeId)
    .eq("kind", value.kind)
    .eq("year", value.year)
    .select("storage_path");
  if (error) {
    console.error(`[${LOG}] remoção:`, error.message);
    throw new BirthdayArtHttpError("Não foi possível remover a arte.", 500);
  }
  const paths = (data ?? []).map((row) => row.storage_path as string);
  if (paths.length > 0) {
    const { error: removeError } = await db.storage.from(BIRTHDAY_ARTS_BUCKET).remove(paths);
    if (removeError) console.error(`[${LOG}] arquivo:`, removeError.message);
  }
}
