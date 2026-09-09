import type { Metadata } from "next";
import { ReadingExperience } from "./reading-experience";
import { getPublicReadingRecommendations } from "@/lib/reading-trajectories/server";
import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_TITLE = "Leituras que formam trajetórias | Bismarchi | Pires";
const PAGE_DESCRIPTION =
  "Conheça os livros que marcaram a trajetória dos profissionais do Bismarchi | Pires e as histórias por trás de cada escolha.";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_APP_ORIGIN),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/leituras" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/leituras",
    siteName: "Bismarchi | Pires",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/leituras/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Leituras que formam trajetórias — Bismarchi | Pires",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/leituras/opengraph-image"],
  },
};

export default async function ReadingsPublicPage() {
  const data = await getPublicReadingRecommendations();
  return <ReadingExperience items={data.items} />;
}
