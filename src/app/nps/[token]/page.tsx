import type { Metadata } from "next";
import { NpsPublicClient } from "./nps-public-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Pesquisa NPS — Bismarchi | Pires",
    description: "Pesquisa de satisfação Bismarchi | Pires Sociedade de Advogados.",
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

export default async function PublicNpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <NpsPublicClient token={token} />;
}
