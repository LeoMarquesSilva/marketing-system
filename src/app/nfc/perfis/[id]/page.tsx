import { notFound, redirect } from "next/navigation";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  ProfileHttpError,
  createProfileAdminClient,
  getProfessionalProfileAdmin,
} from "@/lib/profiles/admin";
import { listRecentProfessionalContent } from "@/lib/profiles/content";
import { ProfileEditorClient } from "@/components/nfc/profiles/profile-editor-client";
import type { ProfessionalProfileAdminDetail, ProfileContentItem } from "@/lib/profiles/types";

export const dynamic = "force-dynamic";

/** Limite maior no admin para ainda listar itens ocultos e permitir restaurar. */
const ADMIN_CONTENT_LIMIT = 12;

export default async function NfcProfileEditorPage(context: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireProfessionalProfileAdmin();
  } catch (error) {
    if (error instanceof ProfileHttpError && error.status === 401) {
      redirect("/login");
    }
    redirect("/nfc");
  }

  const { id } = await context.params;

  let detail: ProfessionalProfileAdminDetail;
  try {
    detail = await getProfessionalProfileAdmin(id);
  } catch (error) {
    if (error instanceof ProfileHttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  // hiddenKeys vazio: o painel marca “oculto” com detail.hiddenContentKeys.
  let initialContent: ProfileContentItem[] = [];
  try {
    initialContent = await listRecentProfessionalContent(createProfileAdminClient(), {
      userId: detail.userId,
      userName: detail.userName ?? "",
      hiddenKeys: new Set(),
      limit: ADMIN_CONTENT_LIMIT,
    });
  } catch {
    initialContent = [];
  }

  // JSX fora do try/catch para não capturar erro de renderização.
  return <ProfileEditorClient initialDetail={detail} initialContent={initialContent} />;
}
