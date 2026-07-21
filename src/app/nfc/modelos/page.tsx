import { NfcTemplatesClient } from "@/components/nfc/nfc-templates-client";
import { listNfcTemplates } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export default async function NfcTemplatesPage() {
  return <NfcTemplatesClient templates={await listNfcTemplates()} />;
}

