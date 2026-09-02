import { PublicationTable } from "@/components/operacoes-legais/vistagem/PublicationTable";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import type { Publication, PublicationStatus } from "@/lib/operacoes-legais/vistagem/types";

export const dynamic = "force-dynamic";

const BASE = "/operacoes-legais/vistagem";

export default async function PrazosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; escritorio?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as PublicationStatus) || "PRAZO_PENDENTE";
  let items: Publication[] = [];
  try {
    const { supabase } = await requireVistagemAccess();
    let q = supabase
      .from("publications")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: true });
    if (sp.escritorio) q = q.eq("escritorio_responsavel", sp.escritorio);
    const { data } = await q;
    items = (data || []) as Publication[];
  } catch {
    items = [];
  }

  return (
    <VistagemShell title="Ops Legais · Prazos">
      <p className="mb-4 text-sm text-zinc-400">
        Defina tipo VIOS padronizado + datas (conclusão=limite) e marque AGENDAR. Status atual:{" "}
        <strong>{status}</strong>
      </p>
      <PublicationTable items={items} hrefPrefix={`${BASE}/prazos`} />
    </VistagemShell>
  );
}
