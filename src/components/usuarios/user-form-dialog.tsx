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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import type { User } from "@/lib/users";
import type { Area } from "@/lib/areas";
import { AreaSelectWithCreate } from "./area-select-with-create";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido"),
  department: z.string().min(1, "Departamento é obrigatório"),
  avatar_url: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), "Informe uma URL válida (http ou https)"),
});

export type UserFormValues = z.infer<typeof formSchema>;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Area[];
  onAreasChange: (areas: Area[]) => void;
  editingUser: User | null;
  onSubmit: (values: UserFormValues) => Promise<void>;
  submitLabel?: string;
  error?: string | null;
}

export function UserFormDialog({
  open,
  onOpenChange,
  areas,
  onAreasChange,
  editingUser,
  onSubmit,
  submitLabel = "Adicionar",
  error,
}: UserFormDialogProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      department: "",
      avatar_url: "",
    },
  });

  useEffect(() => {
    if (editingUser) {
      form.reset({
        name: editingUser.name,
        email: editingUser.email || "",
        department: editingUser.department,
        avatar_url: editingUser.avatar_url || "",
      });
    } else {
      form.reset({
        name: "",
        email: "",
        department: "",
        avatar_url: "",
      });
    }
  }, [editingUser, open, form]);

  const isEditing = !!editingUser;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do usuário"
              : "Adicione um usuário que poderá ser selecionado como solicitante"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Maria Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="maria@empresa.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="avatar_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da foto (opcional)</FormLabel>
                  <FormControl>
                    <div className="flex gap-3 items-start">
                      <Input
                        type="url"
                        placeholder="https://exemplo.com/foto.jpg"
                        {...field}
                      />
                      {field.value && (
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={field.value} alt="Preview" />
                          <AvatarFallback className="text-xs">
                            {getInitials(form.watch("name") || "?")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Cole a URL de uma imagem para usar como avatar
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departamento / Área</FormLabel>
                  <FormControl>
                    <AreaSelectWithCreate
                      areas={areas}
                      value={field.value}
                      onValueChange={field.onChange}
                      onAreasChange={onAreasChange}
                      placeholder="Selecione a área"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  isEditing ? "Salvar" : submitLabel
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
