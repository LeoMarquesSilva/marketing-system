"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useAuth } from "@/contexts/auth-context";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

const signUpSchema = loginSchema.extend({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;

export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  const onLogin = async (values: LoginFormValues) => {
    setSubmitError(null);
    const { error } = await signIn(values.email, values.password);
    if (error) {
      setSubmitError(error);
      return;
    }
    router.push("/");
    router.refresh();
  };

  const onSignUp = async (values: SignUpFormValues) => {
    setSubmitError(null);
    const { error } = await signUp(values.email, values.password, values.name);
    if (error) {
      setSubmitError(error);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {isSignUp ? "Criar conta" : "Bem-vindo"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isSignUp ? "Preencha os dados para criar sua conta." : "Entre com seu e-mail e senha para continuar."}
        </p>
      </div>

      {isSignUp ? (
        <Form {...signUpForm}>
          <form
            onSubmit={signUpForm.handleSubmit(onSignUp)}
            className="space-y-4"
          >
            <FormField
              control={signUpForm.control}
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
              control={signUpForm.control}
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
              control={signUpForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <Button type="submit" className="w-full">
              Criar conta
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...loginForm}>
          <form
            onSubmit={loginForm.handleSubmit(onLogin)}
            className="space-y-4"
          >
            <FormField
              control={loginForm.control}
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
              control={loginForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </Form>
      )}

      <button
        type="button"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setSubmitError(null);
          loginForm.reset();
          signUpForm.reset();
        }}
        className="text-sm text-muted-foreground hover:text-foreground w-full"
      >
        {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Criar conta"}
      </button>
    </div>
  );
}
