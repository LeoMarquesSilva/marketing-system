import type { Metadata } from "next";
import { ReadingExperience } from "./reading-experience";
import { getPublicReadingRecommendations } from "@/lib/reading-trajectories/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Leituras que formam trajetórias — Bismarchi | Pires",
  description: "Livros que marcaram a trajetória dos profissionais do Bismarchi | Pires.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: "Leituras que formam trajetórias",
    description: "Conheça as histórias e os motivos por trás de cada escolha.",
    type: "website",
  },
};

export default async function ReadingsPublicPage() {
  const data = await getPublicReadingRecommendations();
  return <ReadingExperience items={data.items} />;
}
