import Link from "next/link";
import { PublicationTable } from "@/components/operacoes-legais/vistagem/PublicationTable";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";

export const dynamic = "force-dynamic";

const BASE = "/operacoes-legais/vistagem";

export default async function ControladoriaPage() {
  let items: Publication[] = [];
  try {
    const { supabase } = await requireVistagemAccess();
    const { data } = await supabase
      .from("publications")
      .select("*")
      .eq("status", "MATCH_PENDENTE")
      .order("created_at", { ascending: true });
    items = (data || []) as Publication[];
  } catch {
    items = [];
  }

  return (
    <VistagemShell title="Controladoria · Match pendente">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Classifique escritório, grupo, demanda de risco e pasta/CI (POSSÍVEL ABERTURA).
        </p>
        <Link
          href={`${BASE}/controladoria/captura`}
          className="rounded-md bg-[#c9a227] px-3 py-1.5 text-sm font-medium text-[#0b1c2c]"
        >
          Captura
        </Link>
      </div>
      <PublicationTable items={items} hrefPrefix={`${BASE}/controladoria`} />
    </VistagemShell>
  );
}
