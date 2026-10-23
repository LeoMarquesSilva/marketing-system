import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { RhHttpError, requireHrManager } from "@/lib/rh/qualifications/server";
import {
  FEEDBACK_PHOTO_MAX_BYTES,
  FEEDBACK_PHOTO_TYPES,
  FEEDBACK_PHOTOS_BUCKET,
  FEEDBACK_PHOTOS_MAX,
  type FeedbackInput,
  type FeedbackPerson,
  type FeedbackPhoto,
  type GoodPracticeFeedback,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const FEEDBACK_SELECT =
  "id, occurred_on, sent_on, employee_id, employee_name, is_team, manager_employee_id, manager_name, area, category, description, manager_action, responded_on, viewed, viewed_on, source, created_at, updated_at, creator:users!hr_good_practice_feedbacks_created_by_fkey(name), photos:hr_good_practice_feedback_photos(count)";

const PHOTO_SELECT = "id, feedback_id, storage_path, file_name, content_type, size_bytes, width, height, taken_at, created_at";
const PHOTO_URL_SECONDS = 60 * 60;

function createFeedbackAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new RhHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type FeedbackRow = Omit<GoodPracticeFeedback, "created_by_name" | "photo_count"> & {
  creator: { name: string } | null;
  photos: { count: number }[] | null;
};

function toFeedback(row: FeedbackRow): GoodPracticeFeedback {
  const { creator, photos, ...rest } = row;
  return { ...rest, created_by_name: creator?.name ?? null, photo_count: photos?.[0]?.count ?? 0 };
}

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const optionalIsoDate = z
  .string()
  .trim()
  .transform((value) => value || null)
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Data inválida");
const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `Informe ${label}.`).max(max, `${label} muito longo.`);

const feedbackSchema = z
  .object({
    occurred_on: isoDate,
    sent_on: isoDate,
    employee_name: requiredText("quem recebeu", 160),
    is_team: z.boolean(),
    manager_name: requiredText("o gestor", 160),
    area: requiredText("a área", 80),
    category: requiredText("a categoria", 160),
    description: requiredText("a ocorrência", 4000),
    manager_action: z
      .string()
      .trim()
      .max(4000)
      .transform((value) => value || null),
    responded_on: optionalIsoDate,
    viewed: z.boolean().nullable(),
    viewed_on: optionalIsoDate,
  })
  .superRefine((value, ctx) => {
    if (value.sent_on < value.occurred_on) {
      ctx.addIssue({ code: "custom", path: ["sent_on"], message: "O envio não pode ser antes da ocorrência." });
    }
    if (value.responded_on && value.responded_on < value.sent_on) {
      ctx.addIssue({ code: "custom", path: ["responded_on"], message: "O retorno não pode ser antes do envio." });
    }
    if (value.viewed_on && value.viewed !== true) {
      ctx.addIssue({ code: "custom", path: ["viewed_on"], message: "Data de visualização só quando visualizado." });
    }
  });

function parseInput(input: unknown) {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  }
  return parsed.data;
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Liga o nome escolhido ao cadastro quando bate com um colaborador (nome livre fica sem vínculo). */
async function resolvePeople(db: SupabaseClient, names: string[]): Promise<Map<string, string>> {
  const { data, error } = await db.from("hr_employees").select("id, full_name");
  if (error) throw new RhHttpError("Falha ao consultar colaboradores.", 500, "QUERY_FAILED");
  const wanted = new Set(names.map(normalizeName));
  const map = new Map<string, string>();
  for (const person of data ?? []) {
    const key = normalizeName(person.full_name as string);
    if (wanted.has(key)) map.set(key, person.id as string);
  }
  return map;
}

async function toRow(db: SupabaseClient, input: FeedbackInput) {
  const value = parseInput(input);
  const ids = await resolvePeople(db, [value.employee_name, value.manager_name]);
  return {
    ...value,
    employee_id: value.is_team ? null : (ids.get(normalizeName(value.employee_name)) ?? null),
    manager_employee_id: ids.get(normalizeName(value.manager_name)) ?? null,
    viewed_on: value.viewed === true ? value.viewed_on : null,
  };
}

export async function listFeedbacks(): Promise<GoodPracticeFeedback[]> {
  await requireHrManager();
  const db = createFeedbackAdminClient();
  const { data, error } = await db
    .from("hr_good_practice_feedbacks")
    .select(FEEDBACK_SELECT)
    .order("sent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[boas-praticas] lista:", error);
    throw new RhHttpError("Falha ao carregar os feedbacks.", 500, "QUERY_FAILED");
  }
  return ((data ?? []) as unknown as FeedbackRow[]).map(toFeedback);
}

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

function nameParts(name: string): string[] {
  return name.trim().split(/\s+/).filter((part) => !NAME_PARTICLES.has(part.toLowerCase()));
}

/** "Caio Augusto de Alcântara César Silva" → "Caio Silva". */
function firstAndLastName(fullName: string): string {
  const parts = nameParts(fullName);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName.trim();
}

/** Nome do organograma quando é curto; "Renato Rossetti Vallim de Castro" → "Renato Rossetti". */
function displayName(orgName: string | undefined, fullName: string): string {
  if (!orgName?.trim()) return firstAndLastName(fullName);
  const parts = nameParts(orgName);
  return parts.length > 3 ? `${parts[0]} ${parts[1]}` : orgName.trim();
}

type EmployeeRow = {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  user_id: string | null;
};

/** Cadastro para escolher colaborador e gestor (ativos e ex-colaboradores), com foto e nome curto. */
export async function listFeedbackPeople(): Promise<FeedbackPerson[]> {
  await requireHrManager();
  const db = createFeedbackAdminClient();
  const [employeesResult, orgResult] = await Promise.all([
    db.from("hr_employees").select("id, full_name, department, position, is_active, user_id").order("full_name"),
    db.from("org_chart_members").select("employee_id, display_name, photo_url, placement"),
  ]);
  if (employeesResult.error) {
    console.error("[boas-praticas] colaboradores:", employeesResult.error);
    throw new RhHttpError("Falha ao carregar colaboradores.", 500, "QUERY_FAILED");
  }
  if (orgResult.error) console.error("[boas-praticas] organograma:", orgResult.error);

  const employees = ((employeesResult.data ?? []) as EmployeeRow[]).filter(
    (person) => !/fênix agendador/i.test(person.full_name)
  );
  const userIds = [...new Set(employees.map((person) => person.user_id).filter(Boolean))] as string[];
  const avatarByUser = new Map<string, string>();
  if (userIds.length) {
    const { data, error } = await db.from("users").select("id, avatar_url, photo_onedrive_url").in("id", userIds);
    if (error) console.error("[boas-praticas] fotos:", error);
    for (const user of data ?? []) {
      const url = resolveEmployeeAvatarUrl(user.avatar_url as string | null, user.photo_onedrive_url as string | null);
      if (url) avatarByUser.set(user.id as string, url);
    }
  }
  const orgByEmployee = new Map<string, { display_name: string; photo_url: string | null }>();
  for (const member of orgResult.data ?? []) {
    if (member.placement === "hidden") continue;
    const current = orgByEmployee.get(member.employee_id as string);
    if (!current || (!current.photo_url && member.photo_url)) {
      orgByEmployee.set(member.employee_id as string, {
        display_name: member.display_name as string,
        photo_url: (member.photo_url as string | null) ?? null,
      });
    }
  }

  return employees.map(({ user_id, ...person }) => {
    const org = orgByEmployee.get(person.id);
    return {
      ...person,
      short_name: displayName(org?.display_name, person.full_name),
      avatar_url: (user_id ? avatarByUser.get(user_id) : undefined) ?? org?.photo_url ?? null,
    };
  });
}

async function readFeedback(db: SupabaseClient, id: string): Promise<GoodPracticeFeedback> {
  const { data, error } = await db.from("hr_good_practice_feedbacks").select(FEEDBACK_SELECT).eq("id", id).maybeSingle();
  if (error) throw new RhHttpError("Falha ao carregar o feedback.", 500, "QUERY_FAILED");
  if (!data) throw new RhHttpError("Feedback não encontrado.", 404, "NOT_FOUND");
  return toFeedback(data as unknown as FeedbackRow);
}

export async function createFeedback(input: FeedbackInput): Promise<GoodPracticeFeedback> {
  const manager = await requireHrManager();
  const db = createFeedbackAdminClient();
  const row = await toRow(db, input);
  const { data, error } = await db
    .from("hr_good_practice_feedbacks")
    .insert({ ...row, source: "sistema", created_by: manager.profileId, updated_by: manager.profileId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[boas-praticas] criar:", error);
    throw new RhHttpError("Não foi possível registrar o feedback.", 500, "INSERT_FAILED");
  }
  return readFeedback(db, data.id as string);
}

export async function updateFeedback(id: string, input: FeedbackInput): Promise<GoodPracticeFeedback> {
  const manager = await requireHrManager();
  const db = createFeedbackAdminClient();
  const row = await toRow(db, input);
  const { data, error } = await db
    .from("hr_good_practice_feedbacks")
    .update({ ...row, updated_by: manager.profileId })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[boas-praticas] editar:", error);
    throw new RhHttpError("Não foi possível salvar o feedback.", 500, "UPDATE_FAILED");
  }
  if (!data) throw new RhHttpError("Feedback não encontrado.", 404, "NOT_FOUND");
  return readFeedback(db, id);
}

export async function deleteFeedback(id: string): Promise<void> {
  await requireHrManager();
  const db = createFeedbackAdminClient();
  // As linhas das fotos caem em cascata; os arquivos do bucket saem aqui.
  const { data: photos } = await db.from("hr_good_practice_feedback_photos").select("storage_path").eq("feedback_id", id);
  const paths = (photos ?? []).map((photo) => photo.storage_path as string);
  if (paths.length) {
    const { error: storageError } = await db.storage.from(FEEDBACK_PHOTOS_BUCKET).remove(paths);
    if (storageError) console.error("[boas-praticas] fotos do feedback excluído:", storageError);
  }
  const { error } = await db.from("hr_good_practice_feedbacks").delete().eq("id", id);
  if (error) {
    console.error("[boas-praticas] excluir:", error);
    throw new RhHttpError("Não foi possível excluir o feedback.", 500, "DELETE_FAILED");
  }
}

/* -------------------------------------------------------------- fotos */

type PhotoRow = Omit<FeedbackPhoto, "url"> & { storage_path: string };

const uuid = z.string().uuid("Identificador inválido.");
const photoType = z.enum(FEEDBACK_PHOTO_TYPES, { message: "Envie a foto em JPG, PNG ou WebP." });
const PHOTO_EXTENSION: Record<(typeof FEEDBACK_PHOTO_TYPES)[number], string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const photoUploadSchema = z.object({
  content_type: photoType,
  size_bytes: z.number().int().positive().max(FEEDBACK_PHOTO_MAX_BYTES, "A foto passa de 10 MB."),
});

const photoRegisterSchema = photoUploadSchema.extend({
  storage_path: z.string().min(1).max(300),
  file_name: z.string().trim().min(1).max(255),
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
  taken_at: z.string().datetime({ offset: true }).nullable(),
});

function parsePhotoInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  }
  return parsed.data;
}

async function ensureFeedback(db: SupabaseClient, feedbackId: string): Promise<void> {
  parsePhotoInput(uuid, feedbackId);
  const { data, error } = await db.from("hr_good_practice_feedbacks").select("id").eq("id", feedbackId).maybeSingle();
  if (error) throw new RhHttpError("Falha ao carregar o feedback.", 500, "QUERY_FAILED");
  if (!data) throw new RhHttpError("Feedback não encontrado.", 404, "NOT_FOUND");
}

async function withSignedUrls(db: SupabaseClient, rows: PhotoRow[]): Promise<FeedbackPhoto[]> {
  if (!rows.length) return [];
  const { data, error } = await db.storage
    .from(FEEDBACK_PHOTOS_BUCKET)
    .createSignedUrls(rows.map((row) => row.storage_path), PHOTO_URL_SECONDS);
  if (error) {
    console.error("[boas-praticas] links das fotos:", error);
    throw new RhHttpError("Não foi possível abrir as fotos.", 500, "SIGN_FAILED");
  }
  const byPath = new Map((data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return rows.flatMap(({ storage_path, ...photo }) => {
    const signed = byPath.get(storage_path);
    return signed ? [{ ...photo, url: signed }] : [];
  });
}

/** URL assinada para o navegador subir a foto direto no bucket privado. */
export async function createPhotoUpload(feedbackId: string, input: unknown): Promise<{ path: string; token: string }> {
  await requireHrManager();
  const db = createFeedbackAdminClient();
  await ensureFeedback(db, feedbackId);
  const value = parsePhotoInput(photoUploadSchema, input);
  const { count } = await db
    .from("hr_good_practice_feedback_photos")
    .select("id", { count: "exact", head: true })
    .eq("feedback_id", feedbackId);
  if ((count ?? 0) >= FEEDBACK_PHOTOS_MAX) {
    throw new RhHttpError(`Cada feedback aceita até ${FEEDBACK_PHOTOS_MAX} fotos.`, 409, "TOO_MANY_PHOTOS");
  }
  const path = `${feedbackId}/${crypto.randomUUID()}.${PHOTO_EXTENSION[value.content_type]}`;
  const { data, error } = await db.storage.from(FEEDBACK_PHOTOS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[boas-praticas] upload assinado:", error);
    throw new RhHttpError("Não foi possível preparar o envio da foto.", 500, "UPLOAD_FAILED");
  }
  return { path: data.path, token: data.token };
}

/** Registra a foto já enviada ao bucket. */
export async function registerPhoto(feedbackId: string, input: unknown): Promise<FeedbackPhoto> {
  const manager = await requireHrManager();
  const db = createFeedbackAdminClient();
  await ensureFeedback(db, feedbackId);
  const value = parsePhotoInput(photoRegisterSchema, input);
  if (!value.storage_path.startsWith(`${feedbackId}/`) || value.storage_path.includes("..")) {
    throw new RhHttpError("Foto de outro feedback.", 400, "INVALID_INPUT");
  }
  const { data, error } = await db
    .from("hr_good_practice_feedback_photos")
    .insert({ ...value, feedback_id: feedbackId, created_by: manager.profileId })
    .select(PHOTO_SELECT)
    .single();
  if (error || !data) {
    console.error("[boas-praticas] registra foto:", error);
    throw new RhHttpError("Não foi possível registrar a foto.", 500, "INSERT_FAILED");
  }
  const [photo] = await withSignedUrls(db, [data as PhotoRow]);
  if (!photo) throw new RhHttpError("A foto não chegou ao armazenamento. Tente de novo.", 500, "UPLOAD_MISSING");
  return photo;
}

export async function listPhotos(feedbackId: string): Promise<FeedbackPhoto[]> {
  await requireHrManager();
  const db = createFeedbackAdminClient();
  await ensureFeedback(db, feedbackId);
  const { data, error } = await db
    .from("hr_good_practice_feedback_photos")
    .select(PHOTO_SELECT)
    .eq("feedback_id", feedbackId)
    .order("created_at");
  if (error) throw new RhHttpError("Falha ao carregar as fotos.", 500, "QUERY_FAILED");
  return withSignedUrls(db, (data ?? []) as PhotoRow[]);
}

export async function deletePhoto(feedbackId: string, photoId: string): Promise<void> {
  await requireHrManager();
  const db = createFeedbackAdminClient();
  parsePhotoInput(uuid, photoId);
  const { data, error } = await db
    .from("hr_good_practice_feedback_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("feedback_id", feedbackId)
    .maybeSingle();
  if (error) throw new RhHttpError("Falha ao carregar a foto.", 500, "QUERY_FAILED");
  if (!data) throw new RhHttpError("Foto não encontrada.", 404, "NOT_FOUND");
  const { error: storageError } = await db.storage.from(FEEDBACK_PHOTOS_BUCKET).remove([data.storage_path as string]);
  if (storageError) console.error("[boas-praticas] remove arquivo da foto:", storageError);
  const { error: deleteError } = await db.from("hr_good_practice_feedback_photos").delete().eq("id", photoId);
  if (deleteError) throw new RhHttpError("Não foi possível excluir a foto.", 500, "DELETE_FAILED");
}
