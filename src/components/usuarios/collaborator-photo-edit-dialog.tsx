"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import type { User } from "@/lib/users";
import {
  uploadCollaboratorPhoto,
} from "@/lib/storage-buckets";

const urlOptional = z
  .string()
  .optional()
  .refine((v) => !v || /^https?:\/\/.+/.test(v), "Informe uma URL válida (http ou https)");

const formSchema = z.object({
  avatar_url: urlOptional,
  photo_onedrive_url: urlOptional,
  photo_collected: z.boolean().optional(),
});

export type CollaboratorPhotoFormValues = z.infer<typeof formSchema>;

interface CollaboratorPhotoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSubmit: (userId: string, values: CollaboratorPhotoFormValues) => Promise<void>;
  error?: string | null;
}

export function CollaboratorPhotoEditDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  error,
}: CollaboratorPhotoEditDialogProps) {
  const form = useForm<CollaboratorPhotoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { avatar_url: "", photo_onedrive_url: "", photo_collected: false },
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      form.reset({
        avatar_url: user.avatar_url || "",
        photo_onedrive_url: user.photo_onedrive_url || "",
        photo_collected: user.photo_collected === true,
      });
      setUploadError(null);
    }
  }, [user, open, form]);

  async function uploadPhoto(file: File) {
    if (!user) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { publicUrl } = await uploadCollaboratorPhoto(user.id, file);
      form.setValue("avatar_url", publicUrl, { shouldValidate: true, shouldDirty: true });
      form.setValue("photo_collected", true, { shouldDirty: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  }

  const previewUrl = form.watch("avatar_url")?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Foto preferida</DialogTitle>
          <DialogDescription>
            {user?.name} — envie a foto para o storage do sistema ou informe links externos (OneDrive/URL).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (!user) return;
              await onSubmit(user.id, values);
            })}
            className="space-y-4"
          >
            {previewUrl ? (
              <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-lg border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={`Preview de ${user?.name ?? "colaborador"}`}
                  className="aspect-[3/4] w-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="mx-auto flex aspect-[3/4] max-h-48 w-full max-w-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-muted-foreground">
                <ImagePlus className="h-8 w-8 opacity-40" />
                <span className="px-4 text-center text-xs">
                  Preview quando o link da foto for URL direta de imagem
                </span>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              disabled={uploading || !user}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Enviando foto…" : "Enviar foto do computador"}
            </Button>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

            <FormField
              control={form.control}
              name="photo_onedrive_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link do OneDrive</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://bp941-my.sharepoint.com/..."
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Link de compartilhamento do arquivo ou pasta no OneDrive.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avatar_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Foto hospedada (URL)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="Preenchido automaticamente após upload"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    URL pública no storage Pro — usada para preview e materiais de marketing.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="photo_collected"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3 rounded-lg border px-3 py-3">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value === true}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-muted-foreground/40"
                    />
                  </FormControl>
                  <div>
                    <FormLabel className="font-normal">Foto obtida</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Marque quando a foto deste colaborador já foi coletada para a figurinha.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2 sm:gap-0">
              {(user?.avatar_url || user?.photo_onedrive_url) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-auto text-muted-foreground"
                  onClick={() =>
                    form.reset({ avatar_url: "", photo_onedrive_url: "", photo_collected: false })
                  }
                >
                  Limpar links
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
