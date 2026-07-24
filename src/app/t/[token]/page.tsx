import type { Metadata } from "next";
import { NfcPublicClient } from "@/components/nfc/nfc-public-client";
import { getNfcPublicTagLabel } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const tagName = await getNfcPublicTagLabel(token).catch(() => null);
  return {
    title: tagName ? `${tagName} — ORQESTRAI` : "Etiqueta NFC — ORQESTRAI",
    description: tagName
      ? `Ação da etiqueta ${tagName} no NFC Hub.`
      : "Ação segura do NFC Hub.",
    robots: { index: false, follow: false },
  };
}

export default async function PublicNfcTagPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <NfcPublicClient token={token} />;
}
