"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
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
import { PASSWORD_RESET_LINK_VALIDITY } from "@/lib/password-reset-email";

const forgotSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordForm({
  defaultEmail,
  onBack,
}: {
  defaultEmail?: string;
  onBack: () => void;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: defaultEmail ?? "" },
  });

  const onSubmit = async (values: ForgotFormValues) => {
    setSubmitError(null);
    try {
      const res = await fetch("/api/account/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d.error ?? "Erro ao enviar o link. Tente de novo.");
        return;
      }
      setSentTo(values.email.trim());
    } catch {
      setSubmitError("Sem conexão com o servidor. Tente de novo.");
    }
  };

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Voltar para o login
    </button>
  );

  if (sentTo) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MailCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Confira seu e-mail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Se houver uma conta ativa com <span className="font-medium text-foreground">{sentTo}</span>, o
            link para criar uma nova senha chega em instantes. Ele vale por {PASSWORD_RESET_LINK_VALIDITY}.
          </p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Não chegou? Olhe a caixa de spam ou lixo eletrônico. Se pedir outro link, use só o do e-mail mais
          recente.
        </p>
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setSentTo(null);
              setSubmitError(null);
            }}
          >
            Enviar de novo
          </Button>
          {backButton}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Esqueceu sua senha?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o e-mail que você usa para entrar. Vamos enviar um link para você criar uma nova senha.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="email@exemplo.com" autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <Button type="submit" className="w-full gap-2" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar link
          </Button>
        </form>
      </Form>

      {backButton}
    </div>
  );
}
