import Link from "next/link";
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
    <VistagemShell title="Central de Publicações">
      <section className="mb-8 rounded-xl border border-[#c9a227]/30 bg-gradient-to-br from-[#152b40] to-[#0b1c2c] p-6">
        <p className="text-sm text-[#c9a227]">BISMARCHI PIRES · OPERAÇÕES LEGAIS</p>
        <h2 className="mt-2 max-w-2xl font-serif text-3xl text-white">
          Captura → vistagem → agendamento VIOS
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Filas no ORQESTRAI. Sem SharePoint no caminho feliz.
        </p>
        {!schemaReady && (
          <p className="mt-3 max-w-2xl rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Schema ainda não está no Supabase deste projeto. A migration
            <code className="mx-1">20260902180000_vistagem.sql</code>
            não foi aplicada — as filas ficam vazias até isso.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`${BASE}/controladoria/captura`}
            className="rounded-md bg-[#c9a227] px-4 py-2 text-sm font-medium text-[#0b1c2c]"
          >
            Rodar captura
          </Link>
          <Link
            href={`${BASE}/jobs`}
            className="rounded-md border border-white/20 px-4 py-2 text-sm text-white"
          >
            Processar jobs
          </Link>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-white/10 bg-white/5 p-5 hover:border-[#c9a227]/50"
          >
            <p className="text-xs uppercase tracking-wide text-zinc-400">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{c.value}</p>
          </Link>
        ))}
      </div>
    </VistagemShell>
  );
}
