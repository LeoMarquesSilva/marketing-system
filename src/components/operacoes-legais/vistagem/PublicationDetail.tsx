import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { formatDateBR } from "@/lib/operacoes-legais/vistagem/dates";
import { StatusBadge } from "@/components/operacoes-legais/vistagem/StatusBadge";
import { Badge } from "@/components/ui/badge";

export function PublicationDetail({ publication: p }: { publication: Publication }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={p.status} />
        <span className="text-sm text-muted-foreground">{p.origem}</span>
        {p.demanda_risco && (
          <Badge variant="destructive">Demanda de risco</Badge>
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
          <div
            key={k as string}
            className="rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm"
          >
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {k}
            </dt>
            <dd className="mt-1 break-words text-foreground">{(v as string) || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Publicação</h3>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {p.publicacao || "—"}
        </pre>
      </div>
      {p.juridico_texto && (
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Jurídico</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.juridico_texto}</p>
        </div>
      )}
    </div>
  );
}
