"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileCheck2, Tag, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { parseBrlInput } from "@/lib/money-br";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import { EventStorageUrlField } from "@/components/eventos/event-storage-url-field";
import { EventoSupplierDialog } from "@/components/eventos/evento-supplier-dialog";
import { SupplierSelectSearch } from "@/components/eventos/supplier-select-search";
import {
  BUDGET_CATEGORIES,
  BUDGET_PAYMENT_LABEL,
  insertEventBudgetItem,
  updateEventBudgetItem,
  type BudgetPaymentStatus,
  type EventBudgetItem,
  type EventSupplier,
} from "@/lib/eventos";
import type { User } from "@/lib/users";

const schema = z.object({
  category: z.string().min(1, "Categoria é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  vendor_name: z.string().optional(),
  amount_planned: z
    .string()
    .min(1, "Valor previsto é obrigatório")
    .refine((v) => (parseBrlInput(v) ?? 0) > 0, "Valor previsto deve ser maior que zero"),
  amount_quoted: z.string().optional(),
  amount_actual: z.string().optional(),
  payment_status: z.enum(["pendente", "parcial", "pago"]),
  due_date: z.string().optional(),
  payment_due_date: z.string().optional(),
  payment_paid_date: z.string().optional(),
  invoice_link: z.string().optional(),
  receipt_link: z.string().optional(),
  approved_by_user_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EventoBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  users?: User[];
  suppliers?: EventSupplier[];
  item?: EventBudgetItem | null;
  onSuccess?: () => void;
  onSupplierPicked?: (supplier: EventSupplier) => void;
  onSupplierCreated?: (supplier: EventSupplier) => void;
}

export function EventoBudgetDialog({
  open,
  onOpenChange,
  eventId,
  users = [],
  suppliers = [],
  item,
  onSuccess,
  onSupplierPicked,
  onSupplierCreated,
}: EventoBudgetDialogProps) {
  const isEdit = !!item;
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [supplierPrefillName, setSupplierPrefillName] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "outros", amount_planned: "", payment_status: "pendente" },
  });

  useEffect(() => {
    if (!open) return;
    if (item) {
      form.reset({
        category: item.category,
        description: item.description ?? "",
        vendor_name: item.vendorName ?? "",
        amount_planned: item.amountPlanned ? String(item.amountPlanned) : "",
        amount_quoted: item.amountQuoted != null ? String(item.amountQuoted) : "",
        amount_actual: item.amountActual != null ? String(item.amountActual) : "",
        payment_status: item.paymentStatus,
        due_date: item.dueDate ?? "",
        payment_due_date: item.paymentDueDate ?? "",
        payment_paid_date: item.paymentPaidDate ?? "",
        invoice_link: item.invoiceLink ?? "",
        receipt_link: item.receiptLink ?? "",
        approved_by_user_id: item.approvedByUserId ?? "__none__",
        notes: item.notes ?? "",
      });
    } else {
      form.reset({
        category: "outros",
        description: "",
        vendor_name: "",
        amount_planned: "",
        amount_quoted: "",
        amount_actual: "",
        payment_status: "pendente",
        due_date: "",
        payment_due_date: "",
        payment_paid_date: "",
        invoice_link: "",
        receipt_link: "",
        approved_by_user_id: "__none__",
        notes: "",
      });
    }
  }, [open, item, form]);

  async function onSubmit(values: FormValues) {
    const payload = {
      category: values.category,
      description: values.description?.trim() || null,
      vendorName: values.vendor_name?.trim() || null,
      amountPlanned: parseBrlInput(values.amount_planned) ?? 0,
      amountQuoted: values.amount_quoted ? parseBrlInput(values.amount_quoted) : null,
      amountActual: values.amount_actual ? parseBrlInput(values.amount_actual) : null,
      paymentStatus: values.payment_status as BudgetPaymentStatus,
      dueDate: values.due_date || null,
      paymentDueDate: values.payment_due_date || null,
      paymentPaidDate: values.payment_paid_date || null,
      invoiceLink: values.invoice_link?.trim() || null,
      receiptLink: values.receipt_link?.trim() || null,
      approvedByUserId:
        values.approved_by_user_id && values.approved_by_user_id !== "__none__"
          ? values.approved_by_user_id
          : null,
      notes: values.notes?.trim() || null,
    };

    let ok = false;
    if (isEdit && item) ok = await updateEventBudgetItem(item.id, payload);
    else {
      ok = !!(await insertEventBudgetItem({
        eventId,
        ...payload,
        sortOrder: 0,
      }));
    }

    if (ok) {
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogHeaderIcon icon={Wallet} />
            <div>
              <DialogTitle className="text-lg">{isEdit ? "Editar linha de orçamento" : "Nova linha de orçamento"}</DialogTitle>
              <DialogDescription className="mt-0.5">
                Registre previsão, cotação, execução financeira e comprovações para manter o evento auditável.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Tag}>Classificação da despesa</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria <span className="text-red-500">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {BUDGET_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vendor_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <FormControl>
                      <SupplierSelectSearch
                        suppliers={suppliers}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onPickExisting={(supplier) => onSupplierPicked?.(supplier)}
                        onCreateNew={(prefill) => {
                          setSupplierPrefillName(prefill);
                          setCreateSupplierOpen(true);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Wallet}>Valores e pagamento</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="amount_planned" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previsto <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount_quoted" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cotado</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount_actual" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Realizado</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="payment_status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status pagamento</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(Object.keys(BUDGET_PAYMENT_LABEL) as BudgetPaymentStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{BUDGET_PAYMENT_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="payment_due_date" render={({ field }) => (
                  <FormItem><FormLabel>Data prevista pagamento</FormLabel><FormControl><DatePickerField value={field.value ?? ""} onChange={field.onChange} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="payment_paid_date" render={({ field }) => (
                  <FormItem><FormLabel>Data real pagamento</FormLabel><FormControl><DatePickerField value={field.value ?? ""} onChange={field.onChange} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={FileCheck2}>Comprovação e aprovação</DialogSectionHeading>
              <p className="text-xs text-muted-foreground -mt-2">
                Envie NF e comprovantes para o storage do sistema ou cole um link externo.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="invoice_link" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota fiscal</FormLabel>
                    <FormControl>
                      <EventStorageUrlField
                        eventId={eventId}
                        folder="orcamento/nota-fiscal"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="URL ou envie a NF"
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="receipt_link" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comprovante</FormLabel>
                    <FormControl>
                      <EventStorageUrlField
                        eventId={eventId}
                        folder="orcamento/comprovante"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="URL ou envie o comprovante"
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="approved_by_user_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aprovado por</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Não informado</SelectItem>
                      {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="sticky bottom-0 -mx-1 -mb-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex justify-end gap-2 px-1 pb-1 pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <EventoSupplierDialog
      open={createSupplierOpen}
      onOpenChange={setCreateSupplierOpen}
      initialName={supplierPrefillName}
      onSuccess={(supplier) => {
        form.setValue("vendor_name", supplier.name);
        onSupplierCreated?.(supplier);
      }}
    />
    </>
  );
}
