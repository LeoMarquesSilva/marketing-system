"use client";

import { useEffect } from "react";
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
import { ImagePlus, Loader2 } from "lucide-react";
import type { User } from "@/lib/users";

const urlOptional = z
  .string()
  .optional()
  .refine((v) => !v || /^https?:\/\/.+/.test(v), "Informe uma URL válida (http ou https)");

const formSchema = z.object({
  avatar_url: urlOptional,
  photo_onedrive_url: urlOptional,
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
    defaultValues: { avatar_url: "", photo_onedrive_url: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        avatar_url: user.avatar_url || "",
        photo_onedrive_url: user.photo_onedrive_url || "",
      });
    }
  }, [user, open, form]);

  const previewUrl = form.watch("avatar_url")?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Foto preferida</DialogTitle>
          <DialogDescription>
            {user?.name} — cadastre o link do OneDrive e/ou a URL da foto para comunicados e posts.
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
                  <FormLabel>Link da foto</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://... (URL direta .jpg, .png)"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    URL usada para preview e download nos materiais de marketing.
                  </p>
                  <FormMessage />
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
                  onClick={() => form.reset({ avatar_url: "", photo_onedrive_url: "" })}
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
