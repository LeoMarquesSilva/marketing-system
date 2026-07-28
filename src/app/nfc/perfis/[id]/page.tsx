import { notFound, redirect } from "next/navigation";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { ProfileHttpError, getProfessionalProfileAdmin } from "@/lib/profiles/admin";
import { ProfileEditorClient } from "@/components/nfc/profiles/profile-editor-client";
import type { ProfessionalProfileAdminDetail } from "@/lib/profiles/types";

export const dynamic = "force-dynamic";

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

  // JSX fora do try/catch para não capturar erro de renderização.
  return <ProfileEditorClient initialDetail={detail} />;
}
