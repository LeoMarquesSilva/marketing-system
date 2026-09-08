import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ReadingRecommendation, ReadingRecommendationsResult } from "./types";
import type { ReadingRecommendationUpdate } from "./validation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const COVER_BUCKET = "reading-trajectories";

export class ReadingTrajectoryError extends Error {
  constructor(message: string, public status = 500, public code = "READING_TRAJECTORY_ERROR") {
    super(message);
  }
}

function adminClient(): SupabaseClient {
  if (!supabaseUrl || !serviceKey) {
    throw new ReadingTrajectoryError("Serviço indisponível.", 503, "SERVICE_UNAVAILABLE");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function nullable(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadRecommendations(includeHidden: boolean): Promise<ReadingRecommendationsResult> {
  const admin = adminClient();
  let query = admin
    .from("reading_trajectory_recommendations")
    .select("id,user_id,public_name,practice_area,role_override,photo_override_url,book_title,book_author,book_cover_url,recommendation_text,trajectory_note,book_link,display_order,is_visible,updated_at")
    .order("display_order", { ascending: true })
    .order("public_name", { ascending: true });
  if (!includeHidden) query = query.eq("is_visible", true);

  const { data: rows, error } = await query;
  if (error) {
    throw new ReadingTrajectoryError("Não foi possível carregar as indicações.", 500, "READINGS_LOAD_FAILED");
  }

  const userIds = (rows ?? []).map((row) => String(row.user_id));
  const [{ data: users, error: usersError }, { data: employees, error: employeesError }] =
    userIds.length
      ? await Promise.all([
          admin.from("users").select("id,name,department,avatar_url").in("id", userIds),
          admin.from("hr_employees").select("user_id,position,department").in("user_id", userIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
  if (usersError || employeesError) {
    throw new ReadingTrajectoryError("Não foi possível carregar os profissionais.", 500, "READINGS_PEOPLE_FAILED");
  }

  const usersById = new Map((users ?? []).map((user) => [String(user.id), user]));
  const employeesByUserId = new Map(
    (employees ?? []).map((employee) => [String(employee.user_id), employee])
  );

  const items: ReadingRecommendation[] = (rows ?? []).map((row) => {
    const userId = String(row.user_id);
    const user = usersById.get(userId);
    const employee = employeesByUserId.get(userId);
    const bookTitle = nullable(row.book_title);
    const recommendationText = nullable(row.recommendation_text);
    const photoOverrideUrl = nullable(row.photo_override_url);
    const profilePhotoUrl = nullable(user?.avatar_url);
    const roleOverride = nullable(row.role_override);
    return {
      id: String(row.id),
      userId,
      publicName: nullable(row.public_name) ?? nullable(user?.name) ?? "Profissional",
      practiceArea: nullable(row.practice_area) ?? nullable(employee?.department) ?? nullable(user?.department) ?? "Área a confirmar",
      role: roleOverride ?? nullable(employee?.position) ?? "Sócio",
      roleOverride,
      profilePhotoUrl,
      photoOverrideUrl,
      photoUrl: photoOverrideUrl ?? profilePhotoUrl,
      bookTitle,
      bookAuthor: nullable(row.book_author),
      bookCoverUrl: nullable(row.book_cover_url),
      recommendationText,
      trajectoryNote: nullable(row.trajectory_note),
      bookLink: nullable(row.book_link),
      displayOrder: Number(row.display_order),
      isVisible: Boolean(row.is_visible),
      isComplete: Boolean(bookTitle && recommendationText),
      updatedAt: String(row.updated_at),
    };
  });

  return {
    items,
    summary: {
      total: items.length,
      visible: items.filter((item) => item.isVisible).length,
      complete: items.filter((item) => item.isComplete).length,
      pending: items.filter((item) => !item.isComplete).length,
    },
  };
}

export function getPublicReadingRecommendations() {
  return loadRecommendations(false);
}

export function getAdminReadingRecommendations() {
  return loadRecommendations(true);
}

export async function updateReadingRecommendation(
  id: string,
  input: ReadingRecommendationUpdate,
  updatedBy: string
): Promise<ReadingRecommendation> {
  const admin = adminClient();
  const { error } = await admin
    .from("reading_trajectory_recommendations")
    .update({
      public_name: input.publicName,
      practice_area: input.practiceArea,
      role_override: input.roleOverride,
      photo_override_url: input.photoOverrideUrl,
      book_title: input.bookTitle,
      book_author: input.bookAuthor,
      book_cover_url: input.bookCoverUrl,
      recommendation_text: input.recommendationText,
      trajectory_note: input.trajectoryNote,
      book_link: input.bookLink,
      display_order: input.displayOrder,
      is_visible: input.isVisible,
      updated_by: updatedBy,
    })
    .eq("id", id);
  if (error) {
    throw new ReadingTrajectoryError("Não foi possível salvar a indicação.", 500, "READING_SAVE_FAILED");
  }
  const refreshed = await getAdminReadingRecommendations();
  const item = refreshed.items.find((candidate) => candidate.id === id);
  if (!item) throw new ReadingTrajectoryError("Indicação não encontrada.", 404, "READING_NOT_FOUND");
  return item;
}

export async function uploadReadingCover(
  id: string,
  file: File,
  updatedBy: string
): Promise<ReadingRecommendation> {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
    throw new ReadingTrajectoryError("Envie uma imagem JPG, PNG ou WebP.", 400, "READING_COVER_TYPE");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new ReadingTrajectoryError("A capa deve ter no máximo 8 MB.", 400, "READING_COVER_SIZE");
  }
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${id}/${Date.now()}.${extension}`;
  const admin = adminClient();
  const { error: uploadError } = await admin.storage
    .from(COVER_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) {
    throw new ReadingTrajectoryError("Não foi possível enviar a capa.", 500, "READING_COVER_UPLOAD_FAILED");
  }
  const { data } = admin.storage.from(COVER_BUCKET).getPublicUrl(path);
  const { error: updateError } = await admin
    .from("reading_trajectory_recommendations")
    .update({ book_cover_url: data.publicUrl, updated_by: updatedBy })
    .eq("id", id);
  if (updateError) {
    await admin.storage.from(COVER_BUCKET).remove([path]);
    throw new ReadingTrajectoryError("Não foi possível vincular a capa.", 500, "READING_COVER_LINK_FAILED");
  }
  const refreshed = await getAdminReadingRecommendations();
  const item = refreshed.items.find((candidate) => candidate.id === id);
  if (!item) throw new ReadingTrajectoryError("Indicação não encontrada.", 404, "READING_NOT_FOUND");
  return item;
}

export function readingTrajectoryApiError(error: unknown) {
  if (error instanceof ReadingTrajectoryError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    return {
      status: error.status,
      body: { error: error.message, code: "READING_TRAJECTORY_ACCESS_ERROR" },
    };
  }
  return { status: 500, body: { error: "Erro inesperado.", code: "READING_TRAJECTORY_ERROR" } };
}
