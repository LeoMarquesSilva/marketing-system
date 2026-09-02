import { JobsClient } from "@/components/operacoes-legais/vistagem/JobsClient";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  let jobs: Array<Record<string, unknown>> = [];
  let results: Array<Record<string, unknown>> = [];
  try {
    const { supabase } = await requireVistagemAccess();
    const { data: j } = await supabase
      .from("schedule_jobs")
      .select("*, publications(numero_processo, tipo_agendamento_label, status, ci)")
      .order("queued_at", { ascending: false })
      .limit(50);
    const { data: r } = await supabase
      .from("schedule_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    jobs = j || [];
    results = r || [];
  } catch {
    /* schema ainda não aplicado */
  }

  return (
    <VistagemShell title="Jobs de agendamento">
      <JobsClient initialJobs={jobs} initialResults={results} />
    </VistagemShell>
  );
}
