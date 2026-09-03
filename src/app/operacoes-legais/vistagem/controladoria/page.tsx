import Link from "next/link";
import { PublicationTable } from "@/components/operacoes-legais/vistagem/PublicationTable";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { Button } from "@/components/ui/button";

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
    <VistagemShell
      title="Controladoria"
      description="Classifique escritório, grupo, demanda de risco e pasta/CI (POSSÍVEL ABERTURA)."
      action={
        <Button asChild>
          <Link href={`${BASE}/controladoria/captura`}>Captura</Link>
        </Button>
      }
    >
      <PublicationTable items={items} hrefPrefix={`${BASE}/controladoria`} />
    </VistagemShell>
  );
}
