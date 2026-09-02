import { PublicationTable } from "@/components/operacoes-legais/vistagem/PublicationTable";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";

export const dynamic = "force-dynamic";

const BASE = "/operacoes-legais/vistagem";

export default async function JuridicoPage({
  searchParams,
}: {
  searchParams: Promise<{ escritorio?: string; risco?: string }>;
}) {
  const sp = await searchParams;
  let items: Publication[] = [];
  try {
    const { supabase } = await requireVistagemAccess();
    let q = supabase
      .from("publications")
      .select("*")
      .eq("status", "JURIDICO_VISTAR")
      .order("demanda_risco", { ascending: false })
      .order("created_at", { ascending: true });
    if (sp.escritorio) q = q.eq("escritorio_responsavel", sp.escritorio);
    if (sp.risco === "1") q = q.eq("demanda_risco", true);
    const { data } = await q;
    items = (data || []) as Publication[];
  } catch {
    items = [];
  }

  return (
    <VistagemShell title="Jurídico · Vistar publicações">
      <p className="mb-4 text-sm text-zinc-400">
        Fila JURIDICO_VISTAR — registre considerações e envie para definição de prazos.
      </p>
      <PublicationTable items={items} hrefPrefix={`${BASE}/juridico`} />
    </VistagemShell>
  );
}
