import type { Metadata } from "next";
import { FichaCadastralPublicClient } from "./ficha-cadastral-public-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Ficha cadastral — Bismarchi | Pires",
  description: "Ficha cadastral de admissão — Pessoas e Cultura, Bismarchi | Pires.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function FichaCadastralPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <FichaCadastralPublicClient token={token} />;
}
