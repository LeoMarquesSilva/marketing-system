"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { resolvePostLoginPathFromProfile } from "@/lib/post-login-path";
import {
  CONTENT_TUTORIAL_SESSION_KEY,
  isContentCollaboratorForTour,
} from "@/lib/content-tour";
import {
  MEUS_CLIENTES_TUTORIAL_SESSION_KEY,
  isMeusClientesUserForTour,
} from "@/lib/meus-clientes-tour";

export default function AlterarSenhaPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  /** Sucesso: bloqueia o formulário e evita reenvio enquanto o navegador redireciona. */
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || saving || done) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Já trocou (ex.: voltou para esta rota com perfil atualizado).
    if (profile && !profile.must_change_password) {
      router.replace(resolvePostLoginPathFromProfile(profile));
    }
  }, [user, profile, loading, router, saving, done]);

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
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw new Error(updErr.message);

      const res = await fetch("/api/account/password-changed", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Erro ao concluir a troca de senha.");
      }

      // Perfil em memória ainda tem must_change_password=true — forçamos false
      // para não resolver de volta para /alterar-senha e cair em loop.
      const profileForRedirect = profile
        ? { ...profile, must_change_password: false }
        : null;
      const target = profileForRedirect
        ? resolvePostLoginPathFromProfile(profileForRedirect)
        : "/";

      setDone(true);

      if (profileForRedirect && isContentCollaboratorForTour(profileForRedirect)) {
        sessionStorage.setItem(CONTENT_TUTORIAL_SESSION_KEY, "1");
        window.location.assign(`${target}?tutorial=1`);
      } else if (profileForRedirect && isMeusClientesUserForTour(profileForRedirect)) {
        sessionStorage.setItem(MEUS_CLIENTES_TUTORIAL_SESSION_KEY, "1");
        // Só adiciona ?tutorial=1 se o destino for Meus Clientes (evita query órfã).
        const url =
          target === "/meus-clientes" || target.startsWith("/meus-clientes?")
            ? `${target}${target.includes("?") ? "&" : "?"}tutorial=1`
            : target;
        window.location.assign(url);
      } else {
        window.location.assign(target);
      }
      // Mantém saving/done até a navegação; não reabilita o formulário.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar a senha.");
      setSaving(false);
      setDone(false);
    }
  }

  const busy = saving || done;

  if (busy) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#101f2e] to-[#0a141c] p-4">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-sm text-white/80">
          {done ? "Senha atualizada. Entrando..." : "Salvando nova senha..."}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#101f2e] to-[#0a141c] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-card sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Defina sua nova senha</h1>
            <p className="text-xs text-muted-foreground">
              Por segurança, você precisa trocar a senha padrão no primeiro acesso.
            </p>
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
                disabled={busy}
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
                disabled={busy}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2" disabled={busy}>
            Salvar e entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
