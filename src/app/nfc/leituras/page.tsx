import { redirect } from "next/navigation";
import { ReadingsAdminClient } from "@/components/nfc/readings/readings-admin-client";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { getAdminReadingRecommendations } from "@/lib/reading-trajectories/server";

export const dynamic = "force-dynamic";

export default async function ReadingsAdminPage() {
  try {
    await requireProfessionalProfileAdmin();
  } catch {
    redirect("/nfc");
  }
  const initialData = await getAdminReadingRecommendations();
  return <ReadingsAdminClient initialData={initialData} />;
}
