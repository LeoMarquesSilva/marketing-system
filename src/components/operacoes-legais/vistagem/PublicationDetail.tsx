import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { formatDateBR } from "@/lib/operacoes-legais/vistagem/dates";
import { StatusBadge } from "@/components/operacoes-legais/vistagem/StatusBadge";

export function PublicationDetail({ publication: p }: { publication: Publication }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={p.status} />
        <span className="text-sm text-zinc-400">{p.origem}</span>
        {p.demanda_risco && (
          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-200">
            Demanda de risco
          </span>
        )}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {[
          ["Processo", p.numero_processo],
          ["Pasta", p.pasta],
          ["CI", p.ci],
          ["Escritório", p.escritorio_responsavel],
          ["Grupo", p.grupo],
          ["Cliente", p.cliente_principal],
          ["Responsável", p.responsavel_principal],
          ["Diário", p.diario_divisao],
          ["Divulgação", formatDateBR(p.data_divulgacao)],
          ["Publicação", formatDateBR(p.data_publicacao)],
          ["Tipo", p.tipo_agendamento_label],
          ["Conclusão", formatDateBR(p.data_conclusao)],
          ["FATAL", formatDateBR(p.data_fatal)],
          ["pxe_id", p.vios_pxe_id],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded border border-white/10 bg-white/5 px-3 py-2">
            <dt className="text-xs uppercase text-zinc-500">{k}</dt>
            <dd className="mt-1 break-words">{(v as string) || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 text-sm font-medium text-[#c9a227]">PUBLICAÇÃO</h3>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">
          {p.publicacao || "—"}
        </pre>
      </div>
      {p.juridico_texto && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-medium text-[#c9a227]">JURÍDICO</h3>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{p.juridico_texto}</p>
        </div>
      )}
    </div>
  );
}
