"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { authFetch } from "@/lib/auth-fetch";
import {
  publicServiceLogoUrl,
  SERVICE_LOGOS_BUCKET,
  type InfraServiceWithPayments,
} from "@/lib/infra-services";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  display_name: z.string().min(1, "Informe um nome"),
  provider: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  billing_url: z
    .string()
    .optional()
    .refine((v) => !v?.trim() || /^https?:\/\/.+/i.test(v.trim()), {
      message: "URL inválida",
    }),
  logo_url: z
    .string()
    .optional()
    .refine((v) => !v?.trim() || /^https?:\/\/.+/i.test(v.trim()), {
      message: "URL inválida",
    }),
  monthly_amount_brl: z.string().optional(),
  monthly_amount_usd: z.string().optional(),
  sort_order: z.number().int().min(0).max(999),
});

export type ServicoCustoFormValues = z.infer<typeof schema>;

interface ServicoCustoEditDialogProps {
  service: InfraServiceWithPayments | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function parseMoney(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function ServicoCustoEditDialog({
  service,
  open,
  onOpenChange,
  onSaved,
}: ServicoCustoEditDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payMonth, setPayMonth] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payBrl, setPayBrl] = useState("");
  const [payUsd, setPayUsd] = useState("");
  const [payDesc, setPayDesc] = useState("");
  const [addingPay, setAddingPay] = useState(false);

  const form = useForm<ServicoCustoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: "",
      provider: "",
      category: "",
      description: "",
      billing_url: "",
      logo_url: "",
      monthly_amount_brl: "",
      monthly_amount_usd: "",
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (!service || !open) return;
    form.reset({
      display_name: service.display_name,
      provider: service.provider ?? "",
      category: service.category ?? "",
      description: service.description ?? "",
      billing_url: service.billing_url ?? "",
      logo_url: service.logo_url ?? "",
      monthly_amount_brl:
        service.monthly_amount_brl != null ? String(service.monthly_amount_brl) : "",
      monthly_amount_usd:
        service.monthly_amount_usd != null ? String(service.monthly_amount_usd) : "",
      sort_order: service.sort_order,
    });
    setPayMonth(new Date().toISOString().slice(0, 7));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayBrl("");
    setPayUsd("");
    setPayDesc("");
    setError(null);
  }, [service, open, form]);

  const previewLogo = form.watch("logo_url")?.trim() || service?.logo_url || "";

  async function uploadLogo(file: File) {
    if (!service) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${service.slug}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(SERVICE_LOGOS_BUCKET)
        .upload(`servicos/${path}`, file, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      form.setValue("logo_url", publicServiceLogoUrl(path), {
        shouldValidate: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar logo.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: ServicoCustoFormValues) {
    if (!service) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api/custos/servicos/${service.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: values.display_name,
          provider: values.provider || null,
          category: values.category || null,
          description: values.description || null,
          billing_url: values.billing_url?.trim() || null,
          logo_url: values.logo_url?.trim() || null,
          monthly_amount_brl: parseMoney(values.monthly_amount_brl),
          monthly_amount_usd: parseMoney(values.monthly_amount_usd),
          sort_order: values.sort_order,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro ao salvar.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function addPayment() {
    if (!service || !payMonth || (!payBrl && !payUsd)) return;
    setAddingPay(true);
    setError(null);
    try {
      const res = await authFetch(`/api/custos/servicos/${service.slug}/pagamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_month: `${payMonth}-01`,
          paid_at: payDate || `${payMonth}-01`,
          amount_brl: parseMoney(payBrl) ?? 0,
          amount_usd: parseMoney(payUsd),
          description: payDesc.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro ao registrar pagamento.");
      onSaved();
      setPayBrl("");
      setPayUsd("");
      setPayDesc("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar pagamento.");
    } finally {
      setAddingPay(false);
    }
  }

  async function removePayment(id: string) {
    if (!service) return;
    setError(null);
    try {
      const res = await authFetch(
        `/api/custos/servicos/${service.slug}/pagamentos?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Erro ao excluir.");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir pagamento.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {service?.display_name}</DialogTitle>
          <DialogDescription>
            Informe quanto pagamos por mês e registre o histórico de pagamentos.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted/40 overflow-hidden",
                  previewLogo && "border-border/60"
                )}
              >
                {previewLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewLogo} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">
                    {service?.display_name?.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  Logo
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthly_amount_brl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor mensal (R$)</FormLabel>
                    <FormControl>
                      <Input placeholder="199.90" inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="monthly_amount_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor mensal (USD)</FormLabel>
                    <FormControl>
                      <Input placeholder="20.00" inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="billing_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link faturamento</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da logo</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {service && service.payments.length > 0 && (
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-sm font-medium">Pagamentos registrados</p>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {service.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-xs gap-2"
                    >
                      <span className="truncate">
                        {p.period_month.slice(0, 7)} — R${" "}
                        {Number(p.amount_brl).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive"
                        onClick={() => void removePayment(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-dashed p-3 space-y-3">
              <p className="text-sm font-medium">Adicionar fatura / pagamento</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Mês de referência</label>
                  <Input
                    type="month"
                    value={payMonth}
                    onChange={(e) => setPayMonth(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Data do pagamento</label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Valor USD</label>
                  <Input
                    placeholder="60.00"
                    inputMode="decimal"
                    value={payUsd}
                    onChange={(e) => setPayUsd(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Valor BRL</label>
                  <Input
                    placeholder="326.17"
                    inputMode="decimal"
                    value={payBrl}
                    onChange={(e) => setPayBrl(e.target.value)}
                  />
                </div>
              </div>
              <Input
                placeholder="Ex.: Fatura YKXMNZ8V-0001 — Cursor Pro Plus"
                value={payDesc}
                onChange={(e) => setPayDesc(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={addingPay || !payMonth || (!payBrl && !payUsd)}
                onClick={() => void addPayment()}
              >
                {addingPay ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Registrar fatura
              </Button>
              <p className="text-xs text-muted-foreground">
                Informe USD e BRL da fatura. Se só informar BRL, o PTAX do dia calcula o USD
                automaticamente.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar serviço
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
