import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";

export const dynamic = "force-dynamic";

const BASE = "/operacoes-legais/vistagem";

async function countStatus(status: string) {
  try {
    const { supabase } = await requireVistagemAccess();
    const { count, error } = await supabase
      .from("publications")
      .select("*", { count: "exact", head: true })
      .eq("status", status);
    if (error) return { count: 0, ready: false };
    return { count: count ?? 0, ready: true };
  } catch {
    return { count: 0, ready: false };
  }
}

export default async function VistagemHomePage() {
  const [match, jur, prazo, agendar, ok, erro] = await Promise.all([
    countStatus("MATCH_PENDENTE"),
    countStatus("JURIDICO_VISTAR"),
    countStatus("PRAZO_PENDENTE"),
    countStatus("AGENDAR"),
    countStatus("SIM_OK"),
    countStatus("ERRO"),
  ]);
  const schemaReady = match.ready;

  const cards = [
    { label: "Match pendente", value: match.count, href: `${BASE}/controladoria` },
    { label: "Jurídico vistar", value: jur.count, href: `${BASE}/juridico` },
    { label: "Prazo pendente", value: prazo.count, href: `${BASE}/prazos` },
    { label: "Fila agendar", value: agendar.count, href: `${BASE}/jobs` },
    { label: "SIM-OK", value: ok.count, href: `${BASE}/prazos?status=SIM_OK` },
    { label: "Erros", value: erro.count, href: `${BASE}/jobs` },
  ];

  return (
    <VistagemShell
      title="Vistagem"
      description="Captura, classificação, vistagem jurídica e agendamento no VIOS."
      action={
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`${BASE}/controladoria/captura`}>Rodar captura</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`${BASE}/jobs`}>Processar jobs</Link>
          </Button>
        </div>
      }
    >
      {!schemaReady && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Schema ainda não está no Supabase deste projeto. A migration
          <code className="mx-1">20260902180000_vistagem.sql</code>
          não foi aplicada — as filas ficam vazias até isso.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-border/80 bg-card px-4 py-3 shadow-sm transition-colors hover:border-[#47cdd0]/50"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{c.value}</p>
          </Link>
        ))}
      </div>
    </VistagemShell>
  );
}
