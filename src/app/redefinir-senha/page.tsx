"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Link2Off, Loader2, Lock } from "lucide-react";
import { resolvePostLoginPath } from "@/lib/post-login-path";
import { PASSWORD_RESET_LINK_VALIDITY } from "@/lib/password-reset-email";

/** Mensagens do Supabase Auth que podem aparecer ao salvar a nova senha. */
function translateAuthError(message: string): string {
  if (/different from the old/i.test(message)) return "A nova senha precisa ser diferente da atual.";
  if (/at least|weak|too short/i.test(message)) return "Senha fraca. Use uma senha mais longa, com letras e números.";
  return message;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#04202f] to-[#1c1c1c] p-4">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-6 shadow-2xl dark:bg-card sm:p-8">
        {children}
      </div>
    </div>
  );
}

function RedefinirSenhaContent() {
  const token = useSearchParams().get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  /** Sucesso: bloqueia o formulário enquanto o navegador redireciona. */
  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [error, setError] = useState<string | null>(null);
  // O token vale uma vez só e é validado no envio (não ao abrir a página: o
  // Safe Links do Outlook visita o link antes da pessoa e o gastaria). Depois
  // de validado, uma nova tentativa usa a sessão já aberta.
  const verified = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || done) return;
    setError(null);
    if (newPassword.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (newPassword === "123456") {
      setError("Escolha uma senha diferente da padrão.");
      return;
    }
    if (newPassword !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      if (!verified.current) {
        const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
        if (otpErr) {
          setLinkInvalid(true);
          setSaving(false);
          return;
        }
        verified.current = true;
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw new Error(translateAuthError(updErr.message));

      const res = await fetch("/api/account/password-changed", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recovery: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Erro ao concluir a troca de senha.");
      }

      setDone(true);
      window.location.assign(await resolvePostLoginPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir a senha.");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#04202f] to-[#1c1c1c] p-4">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-sm text-white/80">Senha atualizada. Entrando...</p>
      </div>
    );
  }

  if (linkInvalid) {
    return (
      <Shell>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Link2Off className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Link expirado ou já usado</h1>
            <p className="text-xs text-muted-foreground">
              O link de redefinição vale por {PASSWORD_RESET_LINK_VALIDITY} e funciona uma vez só.
            </p>
          </div>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Peça um novo link na tela de login. Se pediu mais de um, use só o do e-mail mais recente.
        </p>
        <Button asChild className="w-full">
          <Link href="/login?esqueci=1">Pedir novo link</Link>
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
          <h1 className="text-lg font-bold leading-tight">Crie uma nova senha</h1>
          <p className="text-xs text-muted-foreground">Depois de salvar, você já entra no ORQESTRAI com ela.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new">Nova senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              className="pl-9"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmar nova senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              className="pl-9"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full gap-2" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar e entrar
        </Button>
      </form>
    </Shell>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaContent />
    </Suspense>
  );
}
