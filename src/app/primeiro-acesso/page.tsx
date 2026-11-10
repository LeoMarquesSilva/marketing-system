"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound, Link2Off, Loader2, Lock, Mail } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateNewPassword } from "@/lib/password-rules";
import { WELCOME_SETUP_VALIDITY_DAYS } from "@/lib/rh/welcome/types";

/**
 * Primeiro acesso ao ORQESTRAI, pelo botão do e-mail de boas-vindas. Abrir a
 * página não gasta o link (o Safe Links do Outlook visita antes da pessoa);
 * ele vale até a senha ser salva.
 */

type LinkState =
  | { kind: "loading" }
  | { kind: "valid"; firstName: string | null; email: string | null }
  | { kind: "invalid"; reason: "used" | "expired" | "invalid" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-br from-[#04202f] to-[#1c1c1c] p-4">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-6 shadow-2xl dark:bg-card sm:p-8">
        {children}
      </div>
    </div>
  );
}

function PrimeiroAcessoContent() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<LinkState>(token ? { kind: "loading" } : { kind: "invalid", reason: "invalid" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/account/first-access?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { status?: string; firstName?: string | null; email?: string | null }) => {
        if (cancelled) return;
        if (data.status === "valid") setState({ kind: "valid", firstName: data.firstName ?? null, email: data.email ?? null });
        else
          setState({
            kind: "invalid",
            reason: data.status === "used" || data.status === "expired" ? data.status : "invalid",
          });
      })
      .catch(() => !cancelled && setState({ kind: "invalid", reason: "invalid" }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || done) return;
    setError(null);
    const invalid = validateNewPassword(password);
    if (invalid) return setError(invalid);
    if (password !== confirm) return setError("As senhas não coincidem.");

    setSaving(true);
    const response = await fetch("/api/account/first-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { email?: string; error?: string; reason?: string } | null;
    if (!response?.ok || !data?.email) {
      setSaving(false);
      if (data?.reason === "used" || data?.reason === "expired") {
        setState({ kind: "invalid", reason: data.reason });
        return;
      }
      setError(data?.error ?? "Não foi possível criar a senha agora. Tente de novo.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password });
    if (signInError) {
      // A senha foi criada; só o login automático falhou.
      window.location.assign("/login");
      return;
    }
    setDone(true);
    window.location.assign("/meus-links?boas-vindas=1");
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#04202f] to-[#1c1c1c] p-4">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-sm text-white/80">Senha criada. Entrando...</p>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <Shell>
        <div className="flex min-h-[160px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (state.kind === "invalid") {
    return (
      <Shell>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Link2Off className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {state.reason === "used" ? "Este link já foi usado" : "Link expirado ou inválido"}
            </h1>
            <p className="text-xs text-muted-foreground">
              O link de primeiro acesso vale por {WELCOME_SETUP_VALIDITY_DAYS} dias e funciona uma vez só.
            </p>
          </div>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          {state.reason === "used"
            ? "Se você já criou a sua senha, é só entrar. Se esqueceu, use “Esqueci minha senha” na tela de entrada."
            : "Peça um novo e-mail de boas-vindas para Pessoas e Cultura, ou use “Esqueci minha senha” na tela de entrada."}
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Ir para a entrada</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">
            {state.firstName ? `Olá, ${state.firstName}! ` : ""}Crie a sua senha
          </h1>
          <p className="text-xs text-muted-foreground">É o seu primeiro acesso ao ORQESTRAI.</p>
        </div>
      </div>

      {state.email && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Seu login</span>
            <span className="block truncate font-medium">{state.email}</span>
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              className="pl-9"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              className="pl-9"
              placeholder="••••••••"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full gap-2" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar senha e entrar
        </Button>
      </form>
    </Shell>
  );
}

export default function PrimeiroAcessoPage() {
  return (
    <Suspense fallback={null}>
      <PrimeiroAcessoContent />
    </Suspense>
  );
}
