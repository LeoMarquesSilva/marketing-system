import "server-only";

/**
 * Apoio server-side da importação, compartilhado entre as rotas de preview e
 * de apply. Fica fora dos arquivos de rota porque um módulo de rota do Next só
 * pode exportar handlers HTTP.
 */

import { ProfileHttpError, createProfileAdminClient } from "@/lib/profiles/admin";
import type { ImportExistingProfile, ImportUserCandidate } from "@/lib/profiles/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsm", ".xlsx"];

/** Lê e valida a planilha enviada em multipart/form-data. */
export async function readWorkbookFromRequest(request: Request): Promise<ArrayBuffer> {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!file || typeof file === "string") {
    throw new ProfileHttpError("Envie a planilha de colaboradores.", 400, "PROFILE_INVALID");
  }

  const name = (file as File).name?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new ProfileHttpError(
      "Formato não suportado. Envie um arquivo .xlsm ou .xlsx.",
      400,
      "PROFILE_INVALID"
    );
  }

  if (((file as File).size ?? 0) > MAX_UPLOAD_BYTES) {
    throw new ProfileHttpError("Arquivo acima de 5 MB.", 400, "PROFILE_INVALID");
  }

  return (file as File).arrayBuffer();
}

type Row = Record<string, unknown>;

/** Usuários e perfis atuais usados como base da reconciliação. */
export async function loadReconciliationContext(): Promise<{
  users: ImportUserCandidate[];
  profiles: ImportExistingProfile[];
}> {
  const db = createProfileAdminClient();

  const [{ data: userRows }, { data: profileRows }, { data: localizationRows }] = await Promise.all([
    db.from("users").select("id, email, name"),
    db
      .from("professional_profiles")
      .select("id, user_id, slug, professional_email, professional_phone, joined_on"),
    db
      .from("professional_profile_localizations")
      .select("profile_id, locale, display_name, role, practice_area")
      .eq("locale", "pt-BR"),
  ]);

  const profileRowsTyped = (profileRows ?? []) as unknown as Row[];

  // A localização vem por profile_id; casamos com user_id para comparar.
  const userIdByProfileId = new Map(
    profileRowsTyped.map((row) => [row.id as string, row.user_id as string])
  );
  const localizationByUserId = new Map<string, Row>();
  for (const row of (localizationRows ?? []) as unknown as Row[]) {
    const userId = userIdByProfileId.get(row.profile_id as string);
    if (userId) localizationByUserId.set(userId, row);
  }

  const users: ImportUserCandidate[] = ((userRows ?? []) as unknown as Row[]).map((row) => ({
    id: row.id as string,
    email: (row.email as string | null) ?? null,
    name: (row.name as string | null) ?? null,
  }));

  const profiles: ImportExistingProfile[] = profileRowsTyped.map((row) => {
    const userId = row.user_id as string;
    const localization = localizationByUserId.get(userId);
    return {
      userId,
      slug: row.slug as string,
      professionalEmail: (row.professional_email as string | null) ?? null,
      professionalPhone: (row.professional_phone as string | null) ?? null,
      joinedOn: (row.joined_on as string | null) ?? null,
      displayName: (localization?.display_name as string | null) ?? null,
      role: (localization?.role as string | null) ?? null,
      practiceArea: (localization?.practice_area as string | null) ?? null,
    };
  });

  return { users, profiles };
}
