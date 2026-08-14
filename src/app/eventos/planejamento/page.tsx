import { PlanejamentoClient } from "@/components/eventos/planejamento-client";
import { fetchPlanejamentoPageData } from "@/lib/eventos-server";

export const dynamic = "force-dynamic";

export default async function PlanejamentoPage() {
  // O planejamento olha para frente: o alvo padrão é o ano que vem.
  const targetYear = new Date().getFullYear() + 1;
  const { forecast, years } = await fetchPlanejamentoPageData(targetYear);

  return <PlanejamentoClient initialForecast={forecast} years={years} />;
}
