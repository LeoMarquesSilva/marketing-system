"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventPayment } from "@/lib/eventos-orcamento";
import type { PaymentInput } from "@/lib/eventos-orcamento-db";
import { parseBrlInput } from "@/lib/money-br";

/** Pagamento do calendário do evento: parcela, sinal ou extra. Sem data = "a definir". */
export function EventoPagamentoDialog({
  payment,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  payment: EventPayment | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: PaymentInput) => void;
  onDelete?: () => void;
}) {
  const [description, setDescription] = useState(payment?.description ?? "");
  const [vendor, setVendor] = useState(payment?.vendorName ?? "");
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "");
  const [dueDate, setDueDate] = useState(payment?.dueDate ?? "");
  const [paid, setPaid] = useState(payment?.paid ?? false);
  const [paidDate, setPaidDate] = useState(payment?.paidDate ?? "");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const value = parseBrlInput(amount);
  const valid = description.trim().length > 1 && value != null && value >= 0;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <div className="flex items-center gap-3 border-b border-[#e6eef0] px-5 py-4 pr-12">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#eaf5f7] text-[#285f73]" aria-hidden>
            <CalendarClock className="size-[18px]" />
          </span>
          <div>
            <DialogTitle className="text-base">{payment ? "Editar pagamento" : "Novo pagamento"}</DialogTitle>
            <DialogDescription className="text-sm">Parcela, sinal ou extra do evento. Sem data, aparece como &quot;a definir&quot;.</DialogDescription>
          </div>
        </div>
        <form
          id="evento-pagamento"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            onSave({
              description: description.trim(),
              vendorName: vendor.trim() || null,
              amount: value ?? 0,
              dueDate: dueDate || null,
              paid,
              paidDate: paid ? paidDate || null : null,
              notes: notes.trim() || null,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pag-descricao">Descrição</Label>
            <Input id="pag-descricao" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Parcela 2 de 3 do pacote" autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pag-fornecedor">Fornecedor</Label>
              <Input id="pag-fornecedor" value={vendor} onChange={(event) => setVendor(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pag-valor">Valor</Label>
              <CurrencyInput id="pag-valor" value={amount} onChange={setAmount} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <DatePickerField value={dueDate} onChange={setDueDate} />
            </div>
            {paid && (
              <div className="space-y-1.5">
                <Label>Pago em</Label>
                <DatePickerField value={paidDate} onChange={setPaidDate} />
              </div>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} className="size-4 accent-[#347796]" />
            Já foi pago
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="pag-obs">Observação</Label>
            <Input id="pag-obs" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: comprovante enviado ao financeiro" />
          </div>
        </form>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {onDelete && (
            <Button type="button" variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={onDelete}>
              Excluir
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="evento-pagamento" size="sm" disabled={busy || !valid}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
