import type { Metadata } from "next";
import { NfcPublicClient } from "@/components/nfc/nfc-public-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Etiqueta NFC — ORQESTRAI",
  description: "Ação segura do NFC Hub.",
  robots: { index: false, follow: false },
};

export default async function PublicNfcTagPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <NfcPublicClient token={token} />;
}
