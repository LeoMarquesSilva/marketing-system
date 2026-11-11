"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Film } from "lucide-react";

interface Summary {
  slug: string;
  title: string;
  pendingDecisions: number;
  shootsScheduled: number;
  shootsTotal: number;
  archiveTotal: number;
}

/** Atalho para o minidocumentário na página do evento (só para quem tem acesso a ele). */
export function DocumentarioEventCard({ eventId }: { eventId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documentario/resumo?evento=${eventId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { summary: Summary | null } | null) => !cancelled && setSummary(data?.summary ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventId]);
  if (!summary) return null;
  return (
    <Link
      href="/documentario"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[#0D1E2E] px-4 py-3 text-sm text-[#d9e2ea] outline-none transition-colors hover:bg-[#13283b] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/50"
    >
      <span className="flex items-center gap-2 font-semibold text-white">
        <Film className="size-4 text-[#E1B16D]" aria-hidden />
        Minidocumentário · {summary.title}
      </span>
      <span>
        {summary.pendingDecisions} {summary.pendingDecisions === 1 ? "decisão pendente" : "decisões pendentes"} dos sócios
      </span>
      <span>
        {summary.shootsScheduled} de {summary.shootsTotal} gravações marcadas
      </span>
      <span>{summary.archiveTotal} itens no acervo</span>
      <ArrowUpRight className="ml-auto size-4 text-[#8fdfe1]" aria-hidden />
    </Link>
  );
}
