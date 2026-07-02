"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, KeyRound, ShieldCheck, Check, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/users";
import { ACCESS_SECTIONS, ACCESS_PRESETS } from "@/lib/access-control";
import { formatAuthDateTime, formatAuthRelative } from "@/lib/users-auth-activity";

interface UserAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUpdated: (id: string, patch: Partial<User>) => void;
}

export function UserAccessDialog({ open, onOpenChange, user, onUpdated }: UserAccessDialogProps) {
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [activating, setActivating] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [authActivity, setAuthActivity] = useState(user?.auth_activity ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email ?? "");
      setPermissions(user.permissions ?? []);
      setAuthActivity(user.auth_activity ?? null);
      setError(null);
      setNotice(null);
    }
  }, [user, open]);

  useEffect(() => {
    if (!open || !user?.auth_id) return;

    let cancelled = false;
    setLoadingActivity(true);
    fetch(`/api/admin/users?userId=${encodeURIComponent(user.id)}`, { credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled || !data.auth_activity) return;
        setAuthActivity(data.auth_activity);
        onUpdated(user.id, { auth_activity: data.auth_activity });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingActivity(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user?.id, user?.auth_id]);

  if (!user) return null;
  const isActive = Boolean(user.auth_id);

  const toggle = (key: string) =>
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const applyPreset = (preset: string) => {
    setPermissions(ACCESS_PRESETS[preset] ? [...ACCESS_PRESETS[preset]] : []);
  };

  async function activate() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Informe o e-mail do usuário para ativar o acesso.");
      return;
    }
    setActivating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", userId: user!.id, email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao ativar acesso");
      onUpdated(user!.id, {
        email: email.trim(),
        is_active: true,
        auth_id: data.auth_id ?? user!.auth_id ?? null,
        must_change_password: true,
        auth_activity: data.auth_activity ?? user!.auth_activity ?? null,
      });
      if (data.auth_activity) setAuthActivity(data.auth_activity);
      setNotice(
        `Acesso pronto! Senha padrão: 123456. ${user!.name.split(" ")[0]} será obrigado a trocá-la no primeiro login.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ativar acesso");
    } finally {
      setActivating(false);
    }
  }

  async function savePerms() {
    setError(null);
    setNotice(null);
    setSavingPerms(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_access", userId: user!.id, permissions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar permissões");
      onUpdated(user!.id, { permissions });
      setNotice("Permissões salvas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar permissões");
    } finally {
      setSavingPerms(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Acesso de {user.name}</DialogTitle>
          <DialogDescription>
            Ative o login com senha padrão e escolha o que este usuário pode ver no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
              {notice}
            </p>
          )}

          {/* Login / ativação */}
          <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <KeyRound className="h-4 w-4" />
                Login
              </p>
              {isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> Acesso ativo
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                  Sem acesso
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-email" className="text-xs">
                E-mail (login)
              </Label>
              <Input
                id="access-email"
                type="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9"
              />
            </div>
            <Button onClick={activate} disabled={activating} size="sm" className="gap-2">
              {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {isActive ? "Redefinir senha para 123456" : "Ativar acesso (senha 123456)"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              A senha padrão é <strong>123456</strong> e o usuário é obrigado a trocá-la no primeiro acesso.
            </p>
            {isActive && (
              <div className="space-y-2 rounded-lg border border-dashed bg-background/80 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Histórico de acesso
                  {loadingActivity && <Loader2 className="h-3 w-3 animate-spin" />}
                </p>
                {authActivity || user.last_seen_at ? (
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Último acesso ao sistema</dt>
                      <dd className="font-medium text-foreground">
                        {user.last_seen_at
                          ? formatAuthDateTime(user.last_seen_at)
                          : "Ainda sem registro de acesso"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Conta criada</dt>
                      <dd className="font-medium text-foreground">
                        {formatAuthDateTime(authActivity?.account_created_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">E-mail confirmado</dt>
                      <dd className="font-medium text-foreground">
                        {formatAuthDateTime(authActivity?.email_confirmed_at)}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Último login com senha</dt>
                      <dd className="font-medium text-foreground">
                        {authActivity?.last_sign_in_at
                          ? formatAuthDateTime(authActivity.last_sign_in_at)
                          : "Ainda não fez login"}
                      </dd>
                      {user.last_seen_at &&
                        authActivity?.last_sign_in_at &&
                        user.last_seen_at !== authActivity.last_sign_in_at && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            O acesso diário usa sessão salva no navegador — por isso pode ser mais
                            recente que o login com senha.
                          </p>
                        )}
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {loadingActivity ? "Carregando dados de acesso…" : "Dados de acesso indisponíveis."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Permissões */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">O que pode ver</p>
              <Select onValueChange={applyPreset}>
                <SelectTrigger className="h-8 w-full text-xs sm:w-52">
                  <SelectValue placeholder="Aplicar um perfil…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(ACCESS_PRESETS).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ACCESS_SECTIONS.map((s) => {
                const checked = permissions.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggle(s.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      checked
                        ? "border-primary/40 bg-primary/[0.06] text-foreground"
                        : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">
                      {s.label}
                      {s.admin && <span className="ml-1 text-[10px] text-muted-foreground">(admin)</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Deixe tudo desmarcado para usar a regra padrão por cargo/área.
            </p>
            <div className="flex justify-end">
              <Button onClick={savePerms} disabled={savingPerms} size="sm" className="gap-2">
                {savingPerms && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar permissões
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
