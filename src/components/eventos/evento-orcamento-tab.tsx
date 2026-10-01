"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeGuestText } from "@/lib/event-guest-import";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BUDGET_PAYMENT_LABEL, formatBrl, type EventBudgetItem } from "@/lib/eventos";

export function EventoOrcamentoTab({
  budgetItems,
  onCreate,
  onEdit,
  onDelete,
}: {
  budgetItems: EventBudgetItem[];
  onCreate: () => void;
  onEdit: (item: EventBudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("all");
  const filtered = useMemo(() => budgetItems.filter(item =>
    (payment === "all" || item.paymentStatus === payment) &&
    normalizeGuestText(`${item.description ?? ""} ${item.vendorName ?? ""} ${item.category}`).includes(normalizeGuestText(search))
  ), [budgetItems, payment, search]);
  const planned = budgetItems.reduce((s, b) => s + b.amountPlanned, 0);
  const quoted = budgetItems.reduce((s, b) => s + (b.amountQuoted ?? 0), 0);
  const actual = budgetItems.reduce((s, b) => s + (b.amountActual ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Orçamento do evento</h2><p className="mt-1 text-xs text-muted-foreground">Acompanhe propostas, custos e pagamentos em cada item.</p></div><Button onClick={onCreate}><Plus className="size-4" />Adicionar despesa</Button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Previsto", planned], ["Cotado", quoted], ["Realizado", actual], ["Diferença (realizado − previsto)", actual - planned]].map(([label, value]) => <div key={label} className="rounded-xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{formatBrl(Number(value))}</p></div>)}</div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar despesa" placeholder="Buscar descrição, fornecedor ou categoria…" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <select aria-label="Filtrar pagamento" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={payment} onChange={event => setPayment(event.target.value)}><option value="all">Todos os pagamentos</option>{Object.entries(BUDGET_PAYMENT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <span className="text-xs text-muted-foreground">{filtered.length} de {budgetItems.length} despesas</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72 w-[45%]">Descrição da despesa</TableHead>
              <TableHead className="text-right">Previsto</TableHead>
              <TableHead className="text-right">Cotado</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {budgetItems.length ? "Nenhuma despesa encontrada para estes filtros." : "Nenhuma despesa cadastrada."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-normal py-4">
                    <button type="button" onClick={() => onEdit(item)} className="text-left text-sm font-semibold leading-6 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">{item.description?.trim() || "Despesa sem descrição"}</button>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {item.vendorName && <span>{item.vendorName}</span>}
                      {item.category && !["fornecedor", "fornecedores", "outros"].includes(normalizeGuestText(item.category)) && <span className="rounded bg-muted px-1.5 py-0.5 capitalize">{item.category.replaceAll("_", " ")}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      {item.invoiceLink ? (
                        <a
                          href={item.invoiceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          NF
                        </a>
                      ) : null}
                      {item.receiptLink ? (
                        <a
                          href={item.receiptLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Comprovante
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatBrl(item.amountPlanned)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{item.amountQuoted != null ? formatBrl(item.amountQuoted) : "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{item.amountActual != null ? formatBrl(item.amountActual) : "—"}</TableCell>
                  <TableCell><span className={`rounded-full px-2 py-1 text-xs ${item.paymentStatus === "pago" ? "bg-emerald-50 text-emerald-700" : item.paymentStatus === "parcial" ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground"}`}>{BUDGET_PAYMENT_LABEL[item.paymentStatus]}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Editar ${item.description || "despesa"}`} onClick={() => onEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Excluir ${item.description || "despesa"}`} onClick={() => onDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
