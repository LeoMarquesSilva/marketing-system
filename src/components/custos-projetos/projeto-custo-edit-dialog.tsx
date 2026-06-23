"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { authFetch } from "@/lib/auth-fetch";
import { PROJECT_LOGOS_BUCKET, publicStorageUrl } from "@/lib/infra-project-profiles";
import type { SupabaseProjectBilling } from "@/lib/supabase-billing";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  display_name: z.string().min(1, "Informe um nome"),
  category: z.string().optional(),
  description: z.string().optional(),
  logo_url: z
    .string()
    .optional()
    .refine((v) => !v?.trim() || /^https?:\/\/.+/i.test(v.trim()), {
      message: "URL inválida",
    }),
  sort_order: z.number().int().min(0).max(999),
});

export type ProjetoCustoFormValues = z.infer<typeof schema>;

interface ProjetoCustoEditDialogProps {
  project: SupabaseProjectBilling | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (projectRef: string, values: ProjetoCustoFormValues & { logo_url: string | null }) => void;
}

export function ProjetoCustoEditDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: ProjetoCustoEditDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ProjetoCustoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: "",
      category: "",
      description: "",
      logo_url: "",
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (!project || !open) return;
    form.reset({
      display_name: project.displayName,
      category: project.category ?? "",
      description: project.description ?? "",
      logo_url: project.logoUrl ?? "",
      sort_order: project.sortOrder,
    });
    setError(null);
  }, [project, open, form]);

  const previewLogo = form.watch("logo_url")?.trim() || project?.logoUrl || "";

  async function uploadLogo(file: File) {
    if (!project) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${project.ref}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(PROJECT_LOGOS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      form.setValue("logo_url", publicStorageUrl(path), { shouldValidate: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar logo.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: ProjetoCustoFormValues) {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api/custos/projetos/${project.ref}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: values.display_name,
          category: values.category || null,
          description: values.description || null,
          logo_url: values.logo_url?.trim() || null,
          sort_order: values.sort_order,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro ao salvar.");
      onSaved(project.ref, {
        ...values,
        logo_url: values.logo_url?.trim() || null,
      } as ProjetoCustoFormValues & { logo_url: string | null });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar projeto</DialogTitle>
          <DialogDescription>
            Personalize como este sistema aparece na página de custos.
            {project && (
              <span className="block mt-1 font-mono text-xs">{project.ref}</span>
            )}
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
                  <img
                    src={previewLogo}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">
                    {project?.displayName?.slice(0, 2).toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
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
                  Enviar logo
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP ou SVG · máx. 2 MB</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da logo (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome exibido</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <Input placeholder="Marketing, CRM, Inovação…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Breve descrição do sistema" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem na lista</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {project && project.supabaseName !== project.displayName && (
              <p className="text-xs text-muted-foreground">
                Nome no Supabase: <span className="font-medium">{project.supabaseName}</span>
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
