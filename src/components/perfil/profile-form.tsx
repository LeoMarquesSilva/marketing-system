"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { updateOwnProfile } from "@/lib/users";
import { fetchAreas } from "@/lib/areas";
import { AREAS } from "@/lib/constants";
import type { AuthProfile } from "@/contexts/auth-context";
import type { Area } from "@/lib/areas";
import { Loader2, Upload } from "lucide-react";
import { useRef } from "react";
import {
  uploadCollaboratorPhoto,
} from "@/lib/storage-buckets";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido"),
  avatar_url: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\/.+/.test(v),
      "Informe uma URL válida (http ou https)"
    ),
  department: z.string().min(1, "Departamento é obrigatório"),
});

type ProfileFormValues = z.infer<typeof formSchema>;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ProfileFormProps {
  profile: AuthProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const { refreshProfile } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: profile.name,
      email: profile.email || "",
      avatar_url: profile.avatar_url || "",
      department: profile.department,
    },
  });

  useEffect(() => {
    form.reset({
      name: profile.name,
      email: profile.email || "",
      avatar_url: profile.avatar_url || "",
      department: profile.department,
    });
  }, [profile, form]);

  useEffect(() => {
    fetchAreas().then(setAreas);
  }, []);

  const baseOptions = areas.length > 0
    ? areas.map((a) => a.name)
    : [...AREAS];
  const currentDept = form.watch("department") || profile.department;
  const departmentOptions =
    currentDept && !baseOptions.includes(currentDept)
      ? [currentDept, ...baseOptions]
      : baseOptions;

  async function onSubmit(values: ProfileFormValues) {
    setSubmitError(null);
    const { error } = await updateOwnProfile({
      name: values.name.trim(),
      email: values.email?.trim() || null,
      avatar_url: values.avatar_url?.trim() || null,
      department: values.department.trim(),
    });
    if (error) {
      setSubmitError(error);
      return;
    }
    await refreshProfile();
  }

  const avatarUrl = form.watch("avatar_url");

  async function uploadAvatar(file: File) {
    setUploading(true);
    setSubmitError(null);
    try {
      const { publicUrl } = await uploadCollaboratorPhoto(profile.id, file);
      form.setValue("avatar_url", publicUrl, { shouldValidate: true, shouldDirty: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage
              src={avatarUrl || profile.avatar_url || undefined}
              className="object-cover"
            />
            <AvatarFallback className="text-xl">
              {getInitials(form.watch("name") || profile.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">
              Sua foto aparece no sistema. Envie uma imagem ou informe a URL abaixo.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAvatar(file);
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
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Enviando…" : "Enviar foto"}
            </Button>
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome" {...field} />
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
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@exemplo.com" {...field} />
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
              <FormLabel>URL da foto</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://exemplo.com/foto.jpg"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento / Área</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {departmentOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar alterações"
          )}
        </Button>
      </form>
    </Form>
  );
}
