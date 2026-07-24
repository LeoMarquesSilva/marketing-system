import { NfcAssetsClient } from "@/components/nfc/nfc-assets-client";
import { listNfcAssetInventory } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export default async function NfcAssetsPage() {
  const data = await listNfcAssetInventory();
  return <NfcAssetsClient initialData={data} />;
}
