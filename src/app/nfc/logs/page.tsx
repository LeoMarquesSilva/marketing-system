import { NfcLogsClient } from "@/components/nfc/nfc-logs-client";
import { listNfcLogs } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export default async function NfcLogsPage() {
  return <NfcLogsClient initialLogs={await listNfcLogs()} />;
}

