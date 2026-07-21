"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Globe, IdCard, Instagram, MessageCircle, Phone, Star, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StarRatingInput } from "@/components/eventos/star-rating-input";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_LABEL,
  upsertSupplier,
  type EventSupplier,
} from "@/lib/eventos";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Informe o nome do prestador"),
  category: z.string().min(1),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  rating: z.string().optional(),
  website_link: z.string().optional(),
  instagram_link: z.string().optional(),
  portfolio_link: z.string().optional(),
  whatsapp_link: z.string().optional(),
  notes: z.string().optional(),
  active: z.string(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_VALUES: FormValues = {
  name: "",
  category: "outros",
  contact_name: "",
  phone: "",
  email: "",
  rating: "",
  website_link: "",
  instagram_link: "",
  portfolio_link: "",
  whatsapp_link: "",
  notes: "",
  active: "true",
};

interface EventoSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: EventSupplier | null;
  initialName?: string;
  onSuccess?: (supplier: EventSupplier) => void;
}

function LinkField({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<"input"> & { icon: React.ElementType }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}

export function EventoSupplierDialog({
  open,
  onOpenChange,
  supplier,
  initialName,
  onSuccess,
}: EventoSupplierDialogProps) {
  const isEdit = !!supplier;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (supplier) {
      form.reset({
        name: supplier.name,
        category: supplier.category,
        contact_name: supplier.contactName ?? "",
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        rating: supplier.rating != null ? String(supplier.rating) : "",
        website_link: supplier.websiteLink ?? "",
        instagram_link: supplier.instagramLink ?? "",
        portfolio_link: supplier.portfolioLink ?? "",
        whatsapp_link: supplier.whatsappLink ?? "",
        notes: supplier.notes ?? "",
        active: supplier.active ? "true" : "false",
      });
    } else {
      form.reset({ ...EMPTY_VALUES, name: initialName ?? "" });
    }
  }, [open, supplier, initialName, form]);

  async function onSubmit(values: FormValues) {
    const saved = await upsertSupplier({
      id: supplier?.id,
      name: values.name.trim(),
      category: values.category,
      contactName: values.contact_name?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      rating: values.rating ? Number(values.rating) : null,
      notes: values.notes?.trim() || undefined,
      active: values.active === "true",
      websiteLink: values.website_link?.trim() || null,
      instagramLink: values.instagram_link?.trim() || null,
      portfolioLink: values.portfolio_link?.trim() || null,
      whatsappLink: values.whatsapp_link?.trim() || null,
    });

    if (saved) {
      onOpenChange(false);
      onSuccess?.(saved);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogHeaderIcon icon={Truck} />
            <div>
              <DialogTitle className="text-lg">{isEdit ? "Editar prestador" : "Novo prestador"}</DialogTitle>
              <DialogDescription className="mt-0.5">
                Cadastre os dados de contato e links do prestador para reutilizar em outros eventos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={IdCard}>Identificação</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="Nome do prestador" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SUPPLIER_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{SUPPLIER_CATEGORY_LABEL[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Phone}>Contato</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="contact_name" render={({ field }) => (
                  <FormItem><FormLabel>Pessoa de contato</FormLabel><FormControl><Input placeholder="Nome do contato" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><PhoneInput value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" placeholder="contato@empresa.com" {...field} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Globe}>Links</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="website_link" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site</FormLabel>
                    <FormControl><LinkField icon={Globe} placeholder="https://..." {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="instagram_link" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram</FormLabel>
                    <FormControl><LinkField icon={Instagram} placeholder="https://instagram.com/..." {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="portfolio_link" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portfólio / Catálogo</FormLabel>
                    <FormControl><LinkField icon={FileText} placeholder="https://..." {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="whatsapp_link" render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl><LinkField icon={MessageCircle} placeholder="https://wa.me/..." {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Star}>Avaliação e observações</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="rating" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avaliação</FormLabel>
                    <FormControl>
                      <StarRatingInput
                        value={field.value ? Number(field.value) : null}
                        onChange={(v) => field.onChange(v == null ? "" : String(v))}
                      />
                    </FormControl>
                  </FormItem>
                )} />
                {isEdit && (
                  <FormField control={form.control} name="active" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situação</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="true">Ativo</SelectItem>
                          <SelectItem value="false">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                )}
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Input placeholder="Notas rápidas sobre o prestador" {...field} /></FormControl></FormItem>
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
  );
}
