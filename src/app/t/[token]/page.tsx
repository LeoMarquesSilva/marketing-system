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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const initialSource = query.source === "qr" ? "qr" : query.source === "nfc" ? "nfc" : undefined;
  return <NfcPublicClient token={token} initialSource={initialSource} />;
}
