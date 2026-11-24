import { Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LinkedinMetricsClient } from "@/components/linkedin/linkedin-metrics-client";
import type { LinkedinMetricsUser } from "@/components/linkedin/linkedin-post-pieces";
import { fetchLinkedinDashboardData } from "@/lib/linkedin-server";
import { fetchLinkedinFreshness, type LinkedinReportFreshness } from "@/lib/social-metrics/server";
import { fetchUsers } from "@/lib/users";
import type { SourceFreshness } from "@/lib/social-metrics/freshness";
import type { LinkedinDashboardData, LinkedinImportRecord } from "@/lib/linkedin-types";

export const dynamic = "force-dynamic";

const EMPTY_DATA: LinkedinDashboardData = {
  dailyMetrics: [],
  followerDailyMetrics: [],
  visitorDailyMetrics: [],
  demographics: [],
  competitorSnapshots: [],
  posts: [],
  imports: [],
  instagramCandidates: [],
  unavailableReason: null,
};

const REPORTS: { type: LinkedinImportRecord["report_type"]; label: string }[] = [
  { type: "content", label: "Conteúdo" },
  { type: "followers", label: "Seguidores" },
  { type: "visitors", label: "Visitantes" },
  { type: "competitors", label: "Concorrentes" },
];

/** Reserva caso a leitura do frescor falhe: monta o mesmo resumo a partir das importações. */
function freshnessFromImports(imports: LinkedinImportRecord[]): { freshness: SourceFreshness; reports: LinkedinReportFreshness[] } {
  const completed = imports.filter((item) => item.status === "completed");
  const reports = REPORTS.map(({ type, label }) => {
    const latest = completed.find((item) => (item.report_type ?? "content") === type);
    return { reportType: type, label, importedAt: latest?.imported_at ?? null, dataUntil: latest?.date_to ?? null };
  });
  return {
    reports,
    freshness: {
      source: "linkedin",
      label: "LinkedIn",
      lastSuccessAt: completed[0]?.imported_at ?? null,
      lastAttemptAt: completed[0]?.imported_at ?? null,
      lastError: null,
      dataUntil: reports[0].dataUntil,
      staleAfterHours: 24 * 35,
      howItArrives: "Importação manual das planilhas exportadas da página do LinkedIn (uma vez por mês).",
    },
  };
}

/**
 * Métricas do LinkedIn. Só lê o banco: os dados chegam pela importação das
 * planilhas exportadas da página (botão "Importar planilhas").
 */
export default async function LinkedinInsightsPage() {
  const [dataResult, freshnessResult, usersResult] = await Promise.allSettled([
    fetchLinkedinDashboardData(),
    fetchLinkedinFreshness(),
    fetchUsers(),
  ]);

  const data: LinkedinDashboardData =
    dataResult.status === "fulfilled"
      ? dataResult.value
      : {
          ...EMPTY_DATA,
          unavailableReason: dataResult.reason instanceof Error ? dataResult.reason.message : "Métricas do LinkedIn indisponíveis.",
        };
  const { freshness, reports } = freshnessResult.status === "fulfilled" ? freshnessResult.value : freshnessFromImports(data.imports);
  // Só o que a tela usa (foto e nome): a lista completa traz permissões e e-mails.
  const users: LinkedinMetricsUser[] =
    usersResult.status === "fulfilled"
      ? usersResult.value.map((user) => ({ id: user.id, name: user.name, avatar_url: user.avatar_url, auth_id: user.auth_id ?? null }))
      : [];

  return (
    <TooltipProvider>
      <Suspense>
        <LinkedinMetricsClient data={data} freshness={freshness} reports={reports} users={users} />
      </Suspense>
    </TooltipProvider>
  );
}
