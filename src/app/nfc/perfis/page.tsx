import { redirect } from "next/navigation";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { ProfileHttpError, listProfessionalProfiles } from "@/lib/profiles/admin";
import { ProfilesDashboardClient } from "@/components/nfc/profiles/profiles-dashboard-client";

export const dynamic = "force-dynamic";

export default async function NfcProfilesPage() {
  try {
    // Perfis exigem papel admin: ter apenas a permissão /nfc não basta.
    await requireProfessionalProfileAdmin();
  } catch (error) {
    if (error instanceof ProfileHttpError && error.status === 401) {
      redirect("/login");
    }
    redirect("/nfc");
  }

  const initialData = await listProfessionalProfiles();
  return <ProfilesDashboardClient initialData={initialData} />;
}
