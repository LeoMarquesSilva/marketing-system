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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Previsto: <strong>{formatBrl(planned)}</strong>
          {" · "}
          Cotado: <strong>{formatBrl(quoted)}</strong>
          {" · "}
          Realizado: <strong>{formatBrl(actual)}</strong>
          {" · "}
          Diferença: <strong>{formatBrl(actual - planned)}</strong>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Linha de orçamento
        </Button>
      </div>

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
                  <TableCell className="capitalize text-sm">{item.category}</TableCell>
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
                          className="inline-flex items-center gap-1 text-violet-600 hover:underline"
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
                          className="inline-flex items-center gap-1 text-violet-600 hover:underline"
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
                      <Button size="icon" variant="ghost" onClick={() => onEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(item.id)}>
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
