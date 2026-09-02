"use client";

import Link from "next/link";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { formatDateBR } from "@/lib/operacoes-legais/vistagem/dates";
import { StatusBadge } from "@/components/operacoes-legais/vistagem/StatusBadge";

export function PublicationTable({
  items,
  hrefPrefix,
}: {
  items: Publication[];
  hrefPrefix: string;
}) {
  if (!items.length) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
        Nenhum item nesta fila.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#152b40] text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Escritório</th>
            <th className="px-3 py-2">Processo</th>
            <th className="px-3 py-2">Pasta / CI</th>
            <th className="px-3 py-2">Grupo</th>
            <th className="px-3 py-2">Risco</th>
            <th className="px-3 py-2">Publicação</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-3 py-2">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-3 py-2">{p.escritorio_responsavel || "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{p.numero_processo || "—"}</td>
              <td className="px-3 py-2 text-xs">{p.pasta || "—"}</td>
              <td className="px-3 py-2">{p.grupo || "—"}</td>
              <td className="px-3 py-2">{p.demanda_risco ? "Sim" : "Não"}</td>
              <td className="px-3 py-2">{formatDateBR(p.data_publicacao)}</td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`${hrefPrefix}/${p.id}`}
                  className="text-[#c9a227] hover:underline"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
