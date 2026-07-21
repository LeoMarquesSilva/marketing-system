import { NfcTagsClient } from "@/components/nfc/nfc-tags-client";
import { listNfcTags } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export default async function NfcTagsPage() {
  const tags = await listNfcTags();
  return <NfcTagsClient initialTags={tags} />;
}

