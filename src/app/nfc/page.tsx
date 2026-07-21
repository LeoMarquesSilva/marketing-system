import { NfcDashboardClient } from "@/components/nfc/nfc-dashboard-client";
import { getNfcDashboard } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export default async function NfcDashboardPage() {
  const data = await getNfcDashboard();
  return <NfcDashboardClient data={data} />;
}

