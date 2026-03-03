"use client";

import { useState } from "react";
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
import { supabase } from "@/utils/supabase/client";
import { Loader2, Lock } from "lucide-react";

const schema = z
  .object({
    newPassword: z
      .string()
      .min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setSuccess(false);
    const { error: err } = await supabase.auth.updateUser({
      password: values.newPassword,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess(true);
    form.reset({ newPassword: "", confirmPassword: "" });
  }

  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-[#101f2e]/70" />
        <p className="text-sm font-semibold text-foreground">Alterar senha</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Defina uma nova senha para acessar o sistema. Mínimo 6 caracteres.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar nova senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Senha alterada com sucesso.</p>
          )}
          <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Atualizar senha"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
