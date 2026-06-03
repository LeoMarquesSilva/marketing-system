"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { firstAllowedPath } from "@/lib/access-control";

export default function AlterarSenhaPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Já trocou: sai da tela.
    if (profile && !profile.must_change_password) {
      router.replace(firstAllowedPath(profile));
    }
  }, [user, profile, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      // Reload completo: garante perfil fresco (flag limpa) e evita corrida de redirect.
      const target = profile ? firstAllowedPath(profile) : "/";
      window.location.assign(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar a senha.");
    } finally {
      setSaving(false);
    }
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
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar e entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
