"use client";

import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const planned = budgetItems.reduce((s, b) => s + b.amountPlanned, 0);
  const quoted = budgetItems.reduce((s, b) => s + (b.amountQuoted ?? 0), 0);
  const actual = budgetItems.reduce((s, b) => s + (b.amountActual ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Orçamento do evento</h2><p className="mt-1 text-xs text-muted-foreground">Acompanhe propostas, custos e pagamentos em cada item.</p></div><Button onClick={onCreate}><Plus className="size-4" />Adicionar despesa</Button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Previsto", planned], ["Cotado", quoted], ["Realizado", actual], ["Diferença (realizado − previsto)", actual - planned]].map(([label, value]) => <div key={label} className="rounded-xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{formatBrl(Number(value))}</p></div>)}</div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead>Cotado</TableHead>
              <TableHead>Realizado</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>NF/Comprovante</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgetItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma linha de orçamento.
                </TableCell>
              </TableRow>
            ) : (
              budgetItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm"><span className="font-medium capitalize">{item.category}</span>{item.description && <p className="mt-1 max-w-64 whitespace-normal text-xs leading-5 text-muted-foreground">{item.description}</p>}</TableCell>
                  <TableCell className="text-sm">{item.vendorName || "—"}</TableCell>
                  <TableCell className="text-sm">{formatBrl(item.amountPlanned)}</TableCell>
                  <TableCell className="text-sm">{item.amountQuoted != null ? formatBrl(item.amountQuoted) : "—"}</TableCell>
                  <TableCell className="text-sm">{item.amountActual != null ? formatBrl(item.amountActual) : "—"}</TableCell>
                  <TableCell className="text-sm">{BUDGET_PAYMENT_LABEL[item.paymentStatus]}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col gap-1">
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
                      ) : (
                        <span className="text-muted-foreground">NF —</span>
                      )}
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
                      ) : (
                        <span className="text-muted-foreground">Comp. —</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Editar ${item.category}`} onClick={() => onEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Excluir ${item.category}`} onClick={() => onDelete(item.id)}>
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
